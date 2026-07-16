uniform mat4 u_Model;
uniform mat4 u_World;
uniform mat4 u_Camera;
uniform mat4 u_Projection;
uniform mat4 u_ModelWorldInverseTranspose;

// whether to draw the skybox or a "regular mode"
uniform bool u_DrawSkybox;
// whether to draw the end flash (fullbright, no lighting)
uniform bool u_DrawMoon;

attribute vec3 a_Position;
attribute vec2 a_TexCoord;
attribute float a_Shade;
attribute vec3 a_Normal;

varying vec2 v_TexCoord;
varying float v_Shade;
varying vec3 v_Position;
varying vec2 v_SkyPos;
varying vec3 v_Normal;
varying vec3 v_WorldPosition;

void main() {
    if (u_DrawSkybox) {
        // the position is exactly our "default" square, with a z fixed to .999
        // in other words, draw the square as far away as possible always
        gl_Position = vec4(a_Position.xy, .999, 1.0);
    }
    else {
        gl_Position = u_Projection * u_Camera * u_World * u_Model * vec4(a_Position, 1.0);
    }
    
    v_Position = a_Position;
    v_SkyPos = a_Position.xy;
    v_TexCoord = a_TexCoord;
    v_Shade = a_Shade;
    
    // Transform normal to world space using inverse-transpose matrix
    v_Normal = vec3(u_ModelWorldInverseTranspose * vec4(a_Normal, 0.0));
    
    // Calculate world position for lighting
    v_WorldPosition = vec3(u_World * u_Model * vec4(a_Position, 1.0));
}
