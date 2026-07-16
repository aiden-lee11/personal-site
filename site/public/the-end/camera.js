// camera.js - Camera system
// Camera state, movement, and look-at animation logic

// Keep track of the camera position and orientation for free-flying camera
let g_cameraPosition;  // Vector3 for camera position
let g_cameraYaw;       // horizontal rotation (left/right)
let g_cameraPitch;     // vertical rotation (up/down)

let g_cameraMode = 'free';     // "free" or "drive"

let g_driveForward = { x: 0, y: 0, z: -1 };  // driving direction
let g_driveUp = { x: 0, y: 1, z: 0 };  // terrain normal (up)

// Camera look-at animation state
let g_camLookAnimActive = false;
let g_camLookAnimTime = 0;
let g_camLookAnimDuration = 1000; // ms for full rotation

let g_camStartYaw = 0;
let g_camStartPitch = 0;
let g_camTargetYaw = 0;
let g_camTargetPitch = 0;

// Animation constants for free-flying camera
const CAMERA_MOVE_SPEED = .05;
const CAMERA_ROTATION_SPEED = .08;
const MAX_PITCH = 89.0;

const CAMERA_HEIGHT_OFFSET = 2.0;            // height above terrain when driving
const DRIVE_MOVE_SPEED = 0.007;           // units per ms (slower movement)
const DRIVE_TURN_SPEED = 0.006;           // radians per ms

// Track current crystal index for look-at cycling
let g_currentCrystalIndex = 0;

/*
 * Update camera position each frame (dispatches to free or drive mode)
 */
function updateCameraPosition(deltaMS) {
    if (g_cameraMode === 'drive') {
        updateDrivingCamera(deltaMS);
    } else {
        updateFreeCamera(deltaMS);
    }
}

/*
 * free-flying camera movement 
 */
// GPT helped me with the cameras after much struggle
function updateFreeCamera(deltaMS) {
    // Handle camera yaw rotation with A/D keys (left/right)
    if (g_keysPressed['a']) {
        g_cameraYaw -= CAMERA_ROTATION_SPEED * deltaMS;
    }
    if (g_keysPressed['d']) {
        g_cameraYaw += CAMERA_ROTATION_SPEED * deltaMS;
    }

    // Handle camera pitch rotation with R/F keys (up/down look)
    if (g_keysPressed['r']) {
        g_cameraPitch += CAMERA_ROTATION_SPEED * deltaMS;
        // Clamp pitch to prevent camera flip
        g_cameraPitch = Math.min(g_cameraPitch, MAX_PITCH);
    }
    if (g_keysPressed['f']) {
        g_cameraPitch -= CAMERA_ROTATION_SPEED * deltaMS;
        // Clamp pitch to prevent camera flip
        g_cameraPitch = Math.max(g_cameraPitch, -MAX_PITCH);
    }

    // Calculate forward and right vectors based on camera yaw and pitch
    let yawRad = g_cameraYaw * Math.PI / 180;
    let pitchRad = g_cameraPitch * Math.PI / 180;

    // Forward vector includes both yaw and pitch for true 3D movement
    let forwardX = -Math.sin(yawRad) * Math.cos(pitchRad);
    let forwardY = Math.sin(pitchRad);
    let forwardZ = -Math.cos(yawRad) * Math.cos(pitchRad);

    // Right vector is only affected by yaw (stays on horizontal plane)
    let rightX = Math.cos(yawRad);
    let rightZ = -Math.sin(yawRad);

    // Move forward/backward (W/S keys) in the full 3D direction camera is looking
    if (g_keysPressed['w']) {
        g_cameraPosition.elements[0] += forwardX * CAMERA_MOVE_SPEED * deltaMS;
        g_cameraPosition.elements[1] += forwardY * CAMERA_MOVE_SPEED * deltaMS;
        g_cameraPosition.elements[2] += forwardZ * CAMERA_MOVE_SPEED * deltaMS;
    }
    if (g_keysPressed['s']) {
        g_cameraPosition.elements[0] -= forwardX * CAMERA_MOVE_SPEED * deltaMS;
        g_cameraPosition.elements[1] -= forwardY * CAMERA_MOVE_SPEED * deltaMS;
        g_cameraPosition.elements[2] -= forwardZ * CAMERA_MOVE_SPEED * deltaMS;
    }

    // Strafe left/right (Q/E keys)
    if (g_keysPressed['q']) {
        g_cameraPosition.elements[0] -= rightX * CAMERA_MOVE_SPEED * deltaMS;
        g_cameraPosition.elements[2] -= rightZ * CAMERA_MOVE_SPEED * deltaMS;
    }
    if (g_keysPressed['e']) {
        g_cameraPosition.elements[0] += rightX * CAMERA_MOVE_SPEED * deltaMS;
        g_cameraPosition.elements[2] += rightZ * CAMERA_MOVE_SPEED * deltaMS;
    }
}

/*
 * Driving camera: moves along terrain, rotates with A/D, follows terrain height
 */
// once again GPT helped me with the cameras
function updateDrivingCamera(deltaMS) {
    const moveDist = DRIVE_MOVE_SPEED * deltaMS;
    const turnRad = DRIVE_TURN_SPEED * deltaMS;

    // Turn left/right around global Y (terrain blocks are axis-aligned)
    if (g_keysPressed['a']) {
        g_driveForward = rotateAroundAxis(g_driveForward, { x: 0, y: 1, z: 0 }, -turnRad);
    }
    if (g_keysPressed['d']) {
        g_driveForward = rotateAroundAxis(g_driveForward, { x: 0, y: 1, z: 0 }, turnRad);
    }

    g_driveForward = normalize3(g_driveForward);

    // Move forward/back along surface (XZ plane)
    if (g_keysPressed['w']) {
        g_cameraPosition.elements[0] += g_driveForward.x * moveDist;
        g_cameraPosition.elements[2] += g_driveForward.z * moveDist;
    }
    if (g_keysPressed['s']) {
        g_cameraPosition.elements[0] -= g_driveForward.x * moveDist;
        g_cameraPosition.elements[2] -= g_driveForward.z * moveDist;
    }

    // Sample terrain to stick to ground
    const sample = getTerrainSample(
        g_cameraPosition.elements[0],
        g_cameraPosition.elements[2]
    );

    g_cameraPosition.elements[1] = sample.height + CAMERA_HEIGHT_OFFSET;
    g_driveUp = sample.normal;
}

/**
 * Helper function to split out the camera math for free-flying camera
 */
// once again gpt help
function calculateCameraMatrix() {
    if (g_cameraMode === 'drive') {
        // Driving camera uses g_driveForward & g_driveUp
        const pos = g_cameraPosition;

        const lookAtPoint = new Vector3([
            pos.elements[0] + g_driveForward.x,
            pos.elements[1] + g_driveForward.y,
            pos.elements[2] + g_driveForward.z
        ]);

        const upVec = new Vector3([g_driveUp.x, g_driveUp.y, g_driveUp.z]);

        return new Matrix4().setLookAt(
            pos,
            lookAtPoint,
            upVec
        );
    }

    // Free-flying camera (original)
    // Calculate the direction the camera is looking based on yaw and pitch
    let yawRad = g_cameraYaw * Math.PI / 180;
    let pitchRad = g_cameraPitch * Math.PI / 180;

    // Calculate the look direction vector
    let lookX = -Math.sin(yawRad) * Math.cos(pitchRad);
    let lookY = Math.sin(pitchRad);
    let lookZ = -Math.cos(yawRad) * Math.cos(pitchRad);

    // Calculate the point we're looking at (camera position + look direction)
    let lookAtPoint = new Vector3([
        g_cameraPosition.elements[0] + lookX,
        g_cameraPosition.elements[1] + lookY,
        g_cameraPosition.elements[2] + lookZ
    ]);

    // Create view matrix using lookAt (your helper)
    return new Matrix4().setLookAt(
        g_cameraPosition,
        lookAtPoint,
        new Vector3([0, 1, 0])  // Up vector
    );
}

/**
 * Toggle between free-flying and drive camera modes
 */
// Helped by GPT
function toggleCameraMode() {
    if (g_cameraMode === 'free') {
        // Switch to driving mode
        g_cameraMode = 'drive';

        // Initialize driving forward vector from current yaw/pitch
        let yawRad = g_cameraYaw * Math.PI / 180;
        let pitchRad = g_cameraPitch * Math.PI / 180;

        g_driveForward = {
            x: -Math.sin(yawRad) * Math.cos(pitchRad),
            y: Math.sin(pitchRad),
            z: -Math.cos(yawRad) * Math.cos(pitchRad)
        };

        // Snap to terrain height
        const sample = getTerrainSample(
            g_cameraPosition.elements[0],
            g_cameraPosition.elements[2]
        );
        g_cameraPosition.elements[1] = sample.height + CAMERA_HEIGHT_OFFSET;
        g_driveUp = sample.normal;

        console.log('Camera mode: DRIVE');
    } else {
        // Switch back to free mode
        g_cameraMode = 'free';

        const pos = g_cameraPosition;
        const target = new Vector3([
            pos.elements[0] + g_driveForward.x,
            pos.elements[1] + g_driveForward.y,
            pos.elements[2] + g_driveForward.z
        ]);

        const res = computeYawPitchToLookAt(target, pos);
        g_cameraYaw = res.yaw;
        g_cameraPitch = res.pitch;

        console.log('Camera mode: FREE');
    }
}

/* --------- Look-at functions ---------- */

function lookAtDragon() {
    // World-space dragon position from the scene graph root
    const dragonBase = g_dragonNodes["dragon_base"];
    const dragonPosition = dragonBase.getPosition();
    startLookAtTarget(dragonPosition);
}

// Helper function that Chat GPT generated to help with camera movements
function startLookAtTarget(targetPos) {
    const camPos = g_cameraPosition;

    const target = computeYawPitchToLookAt(targetPos, camPos);

    g_camStartYaw = g_cameraYaw;
    g_camStartPitch = g_cameraPitch;
    g_camTargetYaw = target.yaw;
    g_camTargetPitch = target.pitch;

    g_camLookAnimTime = 0;
    g_camLookAnimActive = true;
}

function updateCameraLookAtLerp(deltaMS) {
    if (!g_camLookAnimActive) return;

    g_camLookAnimTime += deltaMS;
    let t = g_camLookAnimTime / g_camLookAnimDuration;
    if (t >= 1) {
        t = 1;
        g_camLookAnimActive = false;
    }

    const te = smoothstep(t);

    g_cameraYaw = lerpAngleDeg(g_camStartYaw, g_camTargetYaw, te);
    g_cameraPitch = lerp(g_camStartPitch, g_camTargetPitch, te);

    if (g_cameraPitch > MAX_PITCH) g_cameraPitch = MAX_PITCH;
    if (g_cameraPitch < -MAX_PITCH) g_cameraPitch = -MAX_PITCH;
}

/**
 * Compute yaw/pitch in degrees so the camera at camPos looks at targetPos.
 * Uses the same forward convention as updateCameraPosition / calculateCameraMatrix.
 */

// Helper function that Chat GPT generated to help with camera movements
function computeYawPitchToLookAt(targetPos, camPos) {
    const dx = targetPos.elements[0] - camPos.elements[0];
    const dy = targetPos.elements[1] - camPos.elements[1];
    const dz = targetPos.elements[2] - camPos.elements[2];

    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len === 0) {
        return { yaw: g_cameraYaw, pitch: g_cameraPitch };
    }

    const fx = dx / len;
    const fy = dy / len;
    const fz = dz / len;

    const pitchRad = Math.asin(fy);
    const cosPitch = Math.cos(pitchRad);

    let yawRad;
    if (Math.abs(cosPitch) < 1e-6) {
        // looking straight up/down, keep current yaw
        yawRad = g_cameraYaw * Math.PI / 180;
    } else {
        yawRad = Math.atan2(-fx / cosPitch, -fz / cosPitch);
    }

    return {
        yaw: yawRad * 180 / Math.PI,
        pitch: pitchRad * 180 / Math.PI
    };
}

/* --------- Crystal look-at functions ---------- */

function lookAtCurrentCrystal() {
    if (!g_crystalPositions || g_crystalPositions.length === 0) return;

    const p = g_crystalPositions[g_currentCrystalIndex];
    const targetPos = new Vector3([p.x, p.y, p.z]);
    startLookAtTarget(targetPos);
}

function lookAtNextCrystal() {
    if (!g_crystalPositions || g_crystalPositions.length === 0) return;

    g_currentCrystalIndex = (g_currentCrystalIndex + 1) % g_crystalPositions.length;
    lookAtCurrentCrystal();
}

function lookAtPrevCrystal() {
    if (!g_crystalPositions || g_crystalPositions.length === 0) return;

    g_currentCrystalIndex =
        (g_currentCrystalIndex - 1 + g_crystalPositions.length) % g_crystalPositions.length;
    lookAtCurrentCrystal();
}

/**
 * Initialize camera to default starting position
 */
function initCamera() {
    g_cameraPosition = new Vector3([15, 8, 0]);
    g_cameraYaw = 90.0;
    g_cameraPitch = 0.0;
}

