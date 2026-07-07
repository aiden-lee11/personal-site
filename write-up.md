After a summer of learning about best practices on the web, I found myself reflecting on NUFood and the very scrappy way in which I put it together over time. A large point of annoyance for me has always been the loadtimes of the site, which frequently hit 600-800ms not even considering the cold start for the vercel frontend endpoint. Initially, I thought this was purely an issue with the amount of data that comes in the request, as I make one bulk request for the data of the entire site (daily items, all data items, location operation hours, etc) as to allow for instant filtering and transitions of the UI for the user. Thus, I went to check if compression could help, and boy did it with a gzip implementation reducing my request payload size from roughly 700kB to 76kB-- a drastic 10x reduction. However, this was not something that I had to implement, as unbeknownst to me, my hosting service was already implementing this for me... And thus I know have an unused grip implementation on a branch that will never be merged :D 

The real savior of speed came when I realized that my DB is almost entirely read dependent which means that the majority of the DB calls that were causing the long load times were actually unneeded, and we could instead store the data that it holds in-memory and only use the DB as our source of truth in-case of corruption, restarts, or any crashes. This was the first change I made and it was fairly easy to implement, just storing the data after we save in a map in-memory and looking first if we have storage when an user requests data from our backend. The code looks like the following: 

```store.go
package store

import (
	"backend/internal/models"
	"sync"
)

var store *MemoryStore

type MemoryStore struct {
	mu                     sync.RWMutex
	allData                []models.AllDataItem
	weeklyItems            map[string][]models.DailyItem
	locationOperatingTimes []models.LocationOperatingTimes
}

func InitStore() {
	store = NewStore()
}

func NewStore() *MemoryStore {
	return &MemoryStore{
		weeklyItems: make(map[string][]models.DailyItem),
	}
}

func (s *MemoryStore) Set(value any) {
	s.mu.Lock()
	defer s.mu.Unlock()

	switch v := value.(type) {
	case []models.AllDataItem:
		s.allData = v
	case []models.LocationOperatingTimes:
		s.locationOperatingTimes = v
	case map[string][]models.DailyItem:
		s.weeklyItems = v
	default:
		panic("Setting an unsupported type")
	}
}

func (s *MemoryStore) getAllDataItems() []models.AllDataItem {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.allData
}

func (s *MemoryStore) getLocationOperatingTimes() []models.LocationOperatingTimes {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.locationOperatingTimes
}

func (s *MemoryStore) getWeeklyItems() map[string][]models.DailyItem {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.weeklyItems
}

// Exported functions to access the global store
func GetAllDataItems() []models.AllDataItem {
	if store == nil {
		return nil
	}
	return store.getAllDataItems()
}

func GetLocationOperatingTimes() []models.LocationOperatingTimes {
	if store == nil {
		return nil
	}
	return store.getLocationOperatingTimes()
}

func GetWeeklyItems() map[string][]models.DailyItem {
	if store == nil {
		return nil
	}
	return store.getWeeklyItems()
}

func Set(value any) {
	if store != nil {
		store.Set(value)
	}
}
```

As you can see the main methods we have are simply for setting and retrieving for our common data types of daily items, all items, and location operation hours. These are all the static type of data that only change once (either per day or per week) when we go through the data collection process. 

Thus after our collection we simply call `store.Set(data here)`, and the data will then be in memory while the data remains valid. 

This alone was enough to speed up our general data fetch times roughly 10x, providing an incredibly fast experience for our non signed in users. However, for our signed in users, we still were making calls to the DB each time they loaded in for data of their food preferences, nutrition goals, and other user specific fields, which caused the load times to remain at around 400-500ms, which while still improved remained unacceptable.

The solution to this is a user specific cache, in which we cache a users data request and set a TTL at 8 hours to ensure that each day the user data is fresh and in sync with the DB, while removing the load times after the first request for the day, allowing for speed ups for repeated checks during the day (which our signed in users often do, checking for breakfast then lunch then dinner etc). 

The cache implementation was also relatively straightforward: 

```cache.go
package cache

import (
	"backend/internal/models"
	"sync"
	"time"
)

// UserData represents cached user-specific data
type UserData struct {
	UserID         string
	Preferences    []models.AllDataItem
	NutritionGoals models.NutritionGoals
	Mailing        *bool
	LastUpdated    time.Time
	TTL            time.Duration
}

// IsExpired checks if the cached data has expired
func (ud *UserData) IsExpired() bool {
	return time.Since(ud.LastUpdated) > ud.TTL
}

// UserCache manages user-specific cached data
type UserCache struct {
	mu    sync.RWMutex
	users map[string]*UserData
	// Default TTL for cache entries (configurable)
	defaultTTL time.Duration
	// Maximum number of users to cache (LRU eviction)
	maxUsers int
}

// NewUserCache creates a new UserCache instance
func NewUserCache(defaultTTL time.Duration, maxUsers int) *UserCache {
	return &UserCache{
		users:      make(map[string]*UserData),
		defaultTTL: defaultTTL,
		maxUsers:   maxUsers,
	}
}

// GetUserData retrieves cached user data if available and not expired
func (uc *UserCache) GetUserData(userID string) (*UserData, bool) {
	uc.mu.RLock()
	defer uc.mu.RUnlock()

	userData, exists := uc.users[userID]
	if !exists || userData.IsExpired() {
		// Clean up expired entry
		if exists && userData.IsExpired() {
			delete(uc.users, userID)
		}
		return nil, false
	}

	return userData, true
}

// SetUserData caches user data with default TTL
func (uc *UserCache) SetUserData(userID string, preferences []models.AllDataItem, nutritionGoals models.NutritionGoals, mailing *bool) {
	uc.mu.Lock()
	defer uc.mu.Unlock()

	// Implement simple LRU eviction if cache is full
	if len(uc.users) >= uc.maxUsers {
		uc.evictOldestUser()
	}

	uc.users[userID] = &UserData{
		UserID:         userID,
		Preferences:    preferences,
		NutritionGoals: nutritionGoals,
		Mailing:        mailing,
		LastUpdated:    time.Now(),
		TTL:            uc.defaultTTL,
	}
}

// ..more sets

// InvalidateUser removes a user's data from cache
func (uc *UserCache) InvalidateUser(userID string) {
	uc.mu.Lock()
	defer uc.mu.Unlock()
	delete(uc.users, userID)
}

// evictOldestUser removes the user with the oldest LastUpdated time
func (uc *UserCache) evictOldestUser() {
	var oldestUserID string
	var oldestTime time.Time

	for userID, userData := range uc.users {
		if oldestUserID == "" || userData.LastUpdated.Before(oldestTime) {
			oldestUserID = userID
			oldestTime = userData.LastUpdated
		}
	}

	if oldestUserID != "" {
		delete(uc.users, oldestUserID)
	}
}

// CleanupExpired removes all expired entries from cache
func (uc *UserCache) CleanupExpired() {
	uc.mu.Lock()
	defer uc.mu.Unlock()

	for userID, userData := range uc.users {
		if userData.IsExpired() {
			delete(uc.users, userID)
		}
	}
}

// InvalidateUser removes a user from the global cache
func InvalidateUser(userID string) {
	if userCache != nil {
		userCache.InvalidateUser(userID)
	}
}

// CleanupExpired removes expired entries from the global cache
func CleanupExpired() {
	if userCache != nil {
		userCache.CleanupExpired()
	}
}

// StartCleanupRoutine starts a background goroutine to periodically clean expired entries
func StartCleanupRoutine(interval time.Duration) {
	if userCache == nil {
		return
	}

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for range ticker.C {
			CleanupExpired()
		}
	}()
}
```

Overall, users can now see speeds as low as 40 to transfer 700kB of data, a remarkable 20x speedup just by classifying the work my DB was doing :)
