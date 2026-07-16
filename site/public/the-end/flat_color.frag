// created based on other frag files and changed a bit to be more minecraft like with help of cursor
// Modified to add end flash directional lighting and modular point lights

precision highp float;

uniform sampler2D u_Texture;
uniform samplerCube u_Skybox;
uniform bool u_DrawSkybox;
uniform bool u_DrawMoon;
uniform mat4 u_Camera;
uniform mat4 u_Projection;

// End flash directional light
uniform vec3 u_LightDir;  // Direction TO the light source (normalized)
uniform vec3 u_LightColor;  // Color of the light source
uniform bool u_MoonLightEnabled;  // Whether end flash lighting is enabled

// Alpha for fade effects (dragon death animation)
uniform float u_Alpha;

// Point lights (modular system for crystals, torches, etc.)
const int MAX_POINT_LIGHTS = 16;
uniform vec3 u_PointLightPositions[MAX_POINT_LIGHTS];  // World-space positions
uniform vec3 u_PointLightColors[MAX_POINT_LIGHTS];     // RGB colors (with intensity pre-applied)
uniform int u_PointLightCount;                          // Number of active lights
uniform vec3 u_PointLightAttenuation;                   // (constant, linear, quadratic)

varying vec2 v_TexCoord;
varying float v_Shade;
varying vec3 v_Position;
varying vec2 v_SkyPos;
varying vec3 v_Normal;
varying vec3 v_WorldPosition;

// Extract the inverse view rotation matrix from the camera matrix
// This transposes the rotation part (columns become rows) to get the inverse rotation
mat3 getInverseViewRotation(mat4 camera) {
    return mat3(
        vec3(camera[0].x, camera[1].x, camera[2].x),
        vec3(camera[0].y, camera[1].y, camera[2].y),
        vec3(camera[0].z, camera[1].z, camera[2].z)
    );
}

// Calculate point light contribution at a fragment
// Returns the total light color contribution from all active point lights
vec3 calculatePointLights(vec3 worldPos, vec3 worldNormal) {
    vec3 totalLight = vec3(0.0);
    
    for (int i = 0; i < MAX_POINT_LIGHTS; i++) {
        // Early exit if we've processed all active lights
        if (i >= u_PointLightCount) break;
        
        vec3 lightPos = u_PointLightPositions[i];
        vec3 lightColor = u_PointLightColors[i];
        
        // Calculate direction from fragment to light
        vec3 lightDir = lightPos - worldPos;
        float distance = length(lightDir);
        lightDir = normalize(lightDir);
        
        // Calculate diffuse lighting (Lambertian)
        float diffuse = max(dot(worldNormal, lightDir), 0.0);
        
        // Calculate attenuation based on distance
        // attenuation = 1 / (constant + linear*d + quadratic*d^2)
        float attenuation = 1.0 / (
            u_PointLightAttenuation.x + 
            u_PointLightAttenuation.y * distance + 
            u_PointLightAttenuation.z * distance * distance
        );
        
        // Add this light's contribution
        totalLight += lightColor * diffuse * attenuation;
    }
    
    return totalLight;
}

void main() {
    if (u_DrawSkybox) {
        // the key is to sample the texture at the correct spot
        // we can do this with just an inverted camera/projection sample
        // note that we don't care about camera movement, only rotation/scaling
        // this means we can skip the translation entirely by just using a mat3
        
        vec3 viewDir = normalize(vec3(v_SkyPos.xy, -1.0));

        mat3 invViewRot = getInverseViewRotation(u_Camera);

        vec3 worldDir = invViewRot * viewDir;

        // 4. Sample the cubemap with the world direction
        gl_FragColor = textureCube(u_Skybox, worldDir);
    }
    else if (u_DrawMoon) {
        // End flash is rendered fullbright (emissive) - no lighting applied
        vec4 texColor = texture2D(u_Texture, v_TexCoord);
        gl_FragColor = texColor;
    }
    else {
        // Normal rendering
        vec4 texColor = texture2D(u_Texture, v_TexCoord);
        
        // Calculate point light contributions (always active if lights exist)
        vec3 worldNormal = normalize(v_Normal);
        vec3 pointLightContrib = calculatePointLights(v_WorldPosition, worldNormal);
        
        if (u_MoonLightEnabled) {
            // End flash lighting enabled - use directional lighting based on normals
            // Calculate diffuse lighting (dot product of normal and light direction)
            // u_LightDir is the direction TO the light source
            float diffuse = max(dot(worldNormal, u_LightDir), 0.0);
            
            // Add ambient light so shadows aren't completely black
            float ambient = 0.3;
            
            // Combine ambient (neutral white) and diffuse (purple-tinted)
            // Ambient stays neutral, only direct light gets purple tint
            vec3 ambientColor = vec3(ambient);
            vec3 diffuseColor = (1.0 - ambient) * diffuse * u_LightColor;
            
            // Add point light contributions on top of directional lighting
            vec3 litColor = texColor.rgb * (ambientColor + diffuseColor) + texColor.rgb * pointLightContrib;
            
            // Apply alpha uniform for fade effects (like dragon death)
            gl_FragColor = vec4(litColor, texColor.a * u_Alpha);
        } else {
            // End flash lighting disabled - use Minecraft-style face-based lighting
            // v_Shade contains per-face brightness values (top=1.0, bottom=0.5, etc.)
            vec3 baseLight = texColor.rgb * v_Shade;
            
            // Add point light contributions on top of base Minecraft lighting
            vec3 litColor = baseLight + texColor.rgb * pointLightContrib;
            
            gl_FragColor = vec4(litColor, texColor.a * u_Alpha);
        }
    }
}
