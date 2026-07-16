/**
 * terrain.js
 * 
 * An implementation of a terrain generator, which produces a mesh.
 * 
 * Created by Evan Bertis-Sample (PM), Winter 2025
 * Last modified by Dietrich Geisler, Fall 2025
 * 
 */

class TerrainGenerationOptions {
    /**
     * 
     * @param {Number} width width of the terrain
     * @param {Number} height height of the terrain
     * @param {Number} depth depth (Z) of the terrain
     * @param {String} noisefn noise function to use
     * @param {number} seed random seed
     * @param {Number} roughness roughness when using perlin noise
     */
    constructor(width, height, depth, noisefn, seed, roughness) {
        this.width = width;
        this.height = height;
        this.depth = depth;
        this.function = noisefn;
        this.seed = seed;
        this.roughness = roughness;
    }
}

class TerrainGenerator {
    // claude was used for this function
    generateCubeVertices(x, y, z, visibleFaces = null) {
        let vertices = [];
        let uvs = [];
        let shades = [];
        let normals = [];
        
        // Face normal directions
        const NORMAL_FRONT = [0, 0, 1];   // positive Z
        const NORMAL_BACK = [0, 0, -1];   // negative Z
        const NORMAL_TOP = [0, 1, 0];     // positive Y
        const NORMAL_BOTTOM = [0, -1, 0]; // negative Y
        const NORMAL_RIGHT = [1, 0, 0];   // positive X
        const NORMAL_LEFT = [-1, 0, 0];   // negative X

        // If no visible faces specified, render all faces
        if (!visibleFaces) {
            visibleFaces = {
                front: true,
                back: true,
                top: true,
                bottom: true,
                right: true,
                left: true
            };
        }

        // Define the 8 corners of the cube
        let corners = [
            [x, y, z],         // 0: bottom-left-back
            [x + 1, y, z],     // 1: bottom-right-back
            [x + 1, y, z + 1], // 2: bottom-right-front
            [x, y, z + 1],     // 3: bottom-left-front
            [x, y + 1, z],     // 4: top-left-back
            [x + 1, y + 1, z], // 5: top-right-back
            [x + 1, y + 1, z + 1], // 6: top-right-front
            [x, y + 1, z + 1]  // 7: top-left-front
        ];

        // Minecraft-style face shading values
        const SHADE_TOP = 1.0;      // Brightest
        const SHADE_BOTTOM = 0.5;   // Darkest
        const SHADE_NORTH = 0.8;    // North/South faces
        const SHADE_SOUTH = 0.8;
        const SHADE_EAST = 0.6;     // East/West faces
        const SHADE_WEST = 0.6;

        // Front face (positive Z) - counter-clockwise from outside
        if (visibleFaces.front) {
            vertices.push(corners[3], corners[2], corners[6]);
            vertices.push(corners[3], corners[6], corners[7]);
            // UV mapping for front face (2 triangles = 6 UV coords)
            uvs.push([0, 1], [1, 1], [1, 0]);
            uvs.push([0, 1], [1, 0], [0, 0]);
            // Shade values (6 vertices)
            shades.push(SHADE_SOUTH, SHADE_SOUTH, SHADE_SOUTH);
            shades.push(SHADE_SOUTH, SHADE_SOUTH, SHADE_SOUTH);
            // Normals (6 vertices)
            normals.push(NORMAL_FRONT, NORMAL_FRONT, NORMAL_FRONT);
            normals.push(NORMAL_FRONT, NORMAL_FRONT, NORMAL_FRONT);
        }

        // Back face (negative Z) - counter-clockwise from outside
        if (visibleFaces.back) {
            vertices.push(corners[1], corners[0], corners[4]);
            vertices.push(corners[1], corners[4], corners[5]);
            // UV mapping for back face
            uvs.push([0, 1], [1, 1], [1, 0]);
            uvs.push([0, 1], [1, 0], [0, 0]);
            // Shade values
            shades.push(SHADE_NORTH, SHADE_NORTH, SHADE_NORTH);
            shades.push(SHADE_NORTH, SHADE_NORTH, SHADE_NORTH);
            // Normals
            normals.push(NORMAL_BACK, NORMAL_BACK, NORMAL_BACK);
            normals.push(NORMAL_BACK, NORMAL_BACK, NORMAL_BACK);
        }

        // Top face (positive Y) - counter-clockwise from outside
        if (visibleFaces.top) {
            vertices.push(corners[4], corners[7], corners[6]);
            vertices.push(corners[4], corners[6], corners[5]);
            // UV mapping for top face
            uvs.push([0, 0], [0, 1], [1, 1]);
            uvs.push([0, 0], [1, 1], [1, 0]);
            // Shade values
            shades.push(SHADE_TOP, SHADE_TOP, SHADE_TOP);
            shades.push(SHADE_TOP, SHADE_TOP, SHADE_TOP);
            // Normals
            normals.push(NORMAL_TOP, NORMAL_TOP, NORMAL_TOP);
            normals.push(NORMAL_TOP, NORMAL_TOP, NORMAL_TOP);
        }

        // Bottom face (negative Y) - counter-clockwise from outside
        if (visibleFaces.bottom) {
            vertices.push(corners[0], corners[1], corners[2]);
            vertices.push(corners[0], corners[2], corners[3]);
            // UV mapping for bottom face
            uvs.push([0, 0], [1, 0], [1, 1]);
            uvs.push([0, 0], [1, 1], [0, 1]);
            // Shade values
            shades.push(SHADE_BOTTOM, SHADE_BOTTOM, SHADE_BOTTOM);
            shades.push(SHADE_BOTTOM, SHADE_BOTTOM, SHADE_BOTTOM);
            // Normals
            normals.push(NORMAL_BOTTOM, NORMAL_BOTTOM, NORMAL_BOTTOM);
            normals.push(NORMAL_BOTTOM, NORMAL_BOTTOM, NORMAL_BOTTOM);
        }

        // Right face (positive X) - counter-clockwise from outside
        if (visibleFaces.right) {
            vertices.push(corners[1], corners[5], corners[6]);
            vertices.push(corners[1], corners[6], corners[2]);
            // UV mapping for right face
            uvs.push([0, 1], [0, 0], [1, 0]);
            uvs.push([0, 1], [1, 0], [1, 1]);
            // Shade values
            shades.push(SHADE_EAST, SHADE_EAST, SHADE_EAST);
            shades.push(SHADE_EAST, SHADE_EAST, SHADE_EAST);
            // Normals
            normals.push(NORMAL_RIGHT, NORMAL_RIGHT, NORMAL_RIGHT);
            normals.push(NORMAL_RIGHT, NORMAL_RIGHT, NORMAL_RIGHT);
        }

        // Left face (negative X) - counter-clockwise from outside
        if (visibleFaces.left) {
            vertices.push(corners[0], corners[3], corners[7]);
            vertices.push(corners[0], corners[7], corners[4]);
            // UV mapping for left face
            uvs.push([1, 1], [0, 1], [0, 0]);
            uvs.push([1, 1], [0, 0], [1, 0]);
            // Shade values
            shades.push(SHADE_WEST, SHADE_WEST, SHADE_WEST);
            shades.push(SHADE_WEST, SHADE_WEST, SHADE_WEST);
            // Normals
            normals.push(NORMAL_LEFT, NORMAL_LEFT, NORMAL_LEFT);
            normals.push(NORMAL_LEFT, NORMAL_LEFT, NORMAL_LEFT);
        }

        return { vertices, uvs, shades, normals };
    }

    // claude was used for this function  
    generateTerrainMesh(options) {
        // Options must have everything defined
        if (typeof options.width === "undefined") {
            console.error(`options ${JSON.stringify(options)} missing width`);
            return [];
        }
        if (typeof options.height === "undefined") {
            console.error(`options ${JSON.stringify(options)} missing height`);
            return [];
        }
        if (typeof options.depth === "undefined") {
            console.error(`options ${JSON.stringify(options)} missing depth`);
            return [];
        }
        if (typeof options.seed === "undefined") {
            console.error(`options ${JSON.stringify(options)} missing seed`);
            return [];
        }
        if (typeof options.noisefn === "undefined") {
            console.error(`options ${JSON.stringify(options)} missing noisefn`);
            return [];
        }
        if (typeof options.roughness === "undefined") {
            console.error(`options ${JSON.stringify(options)} missing roughness`);
            return [];
        }

        // check that a supported function was provided
        if (!["wave", "simplex", "perlin"].includes(options.noisefn)) {
            console.error(`provided function ${options.noisefn} not supported`);
            return [];
        }

        let vertices = [];
        let uvs = [];
        let shades = [];
        let normals = [];
        let noise = new Noise(options.seed);

        // First pass: Calculate the raw height at each (x, z) position
        // Use shared function for consistency with terrain sampling
        let heightMap = [];
        for (let x = 0; x < options.width; x++) {
            heightMap[x] = [];
            for (let z = 0; z < options.depth; z++) {
                // Calculate raw height without smoothing (smoothing done in second pass for efficiency)
                let floatHeight = calculateTerrainHeightAt(x, z, noise, options, false);
                
                // Store as float for smoothing pass
                heightMap[x][z] = floatHeight;
            }
        }
        
        // Smoothing pass: Average with neighbors to create plateau-like terrain
        let smoothedHeightMap = [];
        const smoothingRadius = 1; // How many neighbors to average
        for (let x = 0; x < options.width; x++) {
            smoothedHeightMap[x] = [];
            for (let z = 0; z < options.depth; z++) {
                let sum = 0;
                let count = 0;
                
                // Average with neighbors
                for (let dx = -smoothingRadius; dx <= smoothingRadius; dx++) {
                    for (let dz = -smoothingRadius; dz <= smoothingRadius; dz++) {
                        const nx = x + dx;
                        const nz = z + dz;
                        if (nx >= 0 && nx < options.width && nz >= 0 && nz < options.depth) {
                            sum += heightMap[nx][nz];
                            count++;
                        }
                    }
                }
                
                smoothedHeightMap[x][z] = sum / count;
            }
        }
        
        // Convert smoothed heights to block heights
        for (let x = 0; x < options.width; x++) {
            for (let z = 0; z < options.depth; z++) {
                heightMap[x][z] = Math.floor(smoothedHeightMap[x][z] + 0.5);
            }
        }

        // Helper function to get height at a position (returns -1 if out of bounds)
        const getHeight = (x, z) => {
            if (x < 0 || x >= options.width || z < 0 || z >= options.depth) {
                return -1;
            }
            return heightMap[x][z];
        };

        // Second pass: Generate blocks with face culling
        for (let x = 0; x < options.width; x++) {
            for (let z = 0; z < options.depth; z++) {
                let maxHeight = heightMap[x][z];

                // Generate blocks from y=0 to maxHeight
                for (let y = 0; y <= maxHeight; y++) {
                    // Determine which faces are visible
                    let visibleFaces = {
                        top: (y === maxHeight),  // Top face only visible on the topmost block
                        bottom: (y === 0),  // Bottom face only visible at ground level
                        front: (getHeight(x, z + 1) < y),  // Front (positive Z) visible if neighbor is shorter
                        back: (getHeight(x, z - 1) < y),   // Back (negative Z) visible if neighbor is shorter
                        right: (getHeight(x + 1, z) < y),  // Right (positive X) visible if neighbor is shorter
                        left: (getHeight(x - 1, z) < y)    // Left (negative X) visible if neighbor is shorter
                    };

                    // Generate cube with only visible faces
                    let cubeData = this.generateCubeVertices(x, y, z, visibleFaces);
                    vertices.push(...cubeData.vertices);
                    uvs.push(...cubeData.uvs);
                    shades.push(...cubeData.shades);
                    normals.push(...cubeData.normals);
                }
            }
        }

        return { vertices, uvs, shades, normals };
    }
}

class Noise {
    // Adapted in part from https://stegu.github.io/webgl-noise/webdemo/
    constructor(seed = 0) {
        // Define an inner helper class for gradient vectors.
        this.Grad = class {
            constructor(x, y, z) {
                this.x = x;
                this.y = y;
                this.z = z;
            }
            dot2(x, y) {
                return this.x * x + this.y * y;
            }
            dot3(x, y, z) {
                return this.x * x + this.y * y + this.z * z;
            }
        };

        // Predefined gradients for 3D (the first 4 are used for 2D)
        this.grad3 = [
            new this.Grad(1, 1, 0), new this.Grad(-1, 1, 0),
            new this.Grad(1, -1, 0), new this.Grad(-1, -1, 0),
            new this.Grad(1, 0, 1), new this.Grad(-1, 0, 1),
            new this.Grad(1, 0, -1), new this.Grad(-1, 0, -1),
            new this.Grad(0, 1, 1), new this.Grad(0, -1, 1),
            new this.Grad(0, 1, -1), new this.Grad(0, -1, -1)
        ];

        // Permutation table, contains a collection of pre-selected semi-random numbers
        this.p = [
            151, 160, 137, 91, 90, 15,
            131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142,
            8, 99, 37, 240, 21, 10, 23,
            190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117,
            35, 11, 32, 57, 177, 33,
            88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71,
            134, 139, 48, 27, 166,
            77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41,
            55, 46, 245, 40, 244,
            102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208,
            89, 18, 169, 200, 196,
            135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52,
            217, 226, 250, 124, 123,
            5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16,
            58, 17, 182, 189, 28, 42,
            223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101,
            155, 167, 43, 172, 9,
            129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104,
            218, 246, 97, 228,
            251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145,
            235, 249, 14, 239, 107,
            49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45,
            127, 4, 150, 254,
            138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66,
            215, 61, 156, 180
        ];
        // Create arrays to hold the permutation and gradient indices.
        this.perm = new Array(512);
        this.gradP = new Array(512);

        // Skewing/unskewing factors for 2D and 3D
        this.F2 = 0.5 * (Math.sqrt(3) - 1);
        this.G2 = (3 - Math.sqrt(3)) / 6;
        this.F3 = 1 / 3;
        this.G3 = 1 / 6;

        // Seed the generator (this fills the perm and gradP arrays)
        this.seed(seed);
    }

    /**
     * Set the seed for the noise generator
     * @param {Number} seed The seed to set
     */
    seed(seed) {
        if (seed > 0 && seed < 1) {
            // Scale the seed up if it’s a fraction.
            seed *= 65536;
        }
        seed = Math.floor(seed);
        if (seed < 256) {
            seed |= seed << 8;
        }
        for (let i = 0; i < 256; i++) {
            let v;
            if (i & 1) {
                v = this.p[i] ^ (seed & 255);
            } else {
                v = this.p[i] ^ ((seed >> 8) & 255);
            }
            this.perm[i] = this.perm[i + 256] = v;
            this.gradP[i] = this.gradP[i + 256] = this.grad3[v % 12];
        }
    }

    /**
     * Internal Helper function to fade the value
     * @param {Number} t time 
     * @returns Fade value
     */
    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    /**
     * Internal Helper function to lerp the value
     * @param {Number} a
     * @param {Number} b
     * @param {Number} t
     * @returns Lerp value
     * */
    lerp(a, b, t) {
        return (1 - t) * a + t * b;
    }

    /*
     * Straightforward wave function
     * @param {Number} xin 
     * @param {Number} yin 
     * @returns The (nonrandom) noise value
     */
    wave2(xin, yin) {
        return (Math.sin(xin) + Math.cos(yin)) / 2;
    }

    /**
     * 2D simplex noise function
     * @param {Number} xin 
     * @param {Number} yin 
     * @returns The noise value
     */
    simplex2(xin, yin) {
        let n0, n1, n2;
        // Skew the input space to determine which simplex cell we're in.
        const s = (xin + yin) * this.F2;
        let i = Math.floor(xin + s);
        let j = Math.floor(yin + s);
        const t = (i + j) * this.G2;
        const x0 = xin - i + t;
        const y0 = yin - j + t;

        // Determine which simplex triangle we are in.
        let i1, j1;
        if (x0 > y0) {
            i1 = 1; j1 = 0;
        } else {
            i1 = 0; j1 = 1;
        }

        // Offsets for the other corners.
        const x1 = x0 - i1 + this.G2;
        const y1 = y0 - j1 + this.G2;
        const x2 = x0 - 1 + 2 * this.G2;
        const y2 = y0 - 1 + 2 * this.G2;

        // Wrap the integer indices at 255.
        i &= 255;
        j &= 255;
        const gi0 = this.gradP[i + this.perm[j]];
        const gi1 = this.gradP[i + i1 + this.perm[j + j1]];
        const gi2 = this.gradP[i + 1 + this.perm[j + 1]];

        // Calculate the contribution from the three corners.
        let t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 < 0) {
            n0 = 0;
        } else {
            t0 *= t0;
            n0 = t0 * t0 * gi0.dot2(x0, y0);
        }

        let t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 < 0) {
            n1 = 0;
        } else {
            t1 *= t1;
            n1 = t1 * t1 * gi1.dot2(x1, y1);
        }

        let t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 < 0) {
            n2 = 0;
        } else {
            t2 *= t2;
            n2 = t2 * t2 * gi2.dot2(x2, y2);
        }

        // The result is scaled to return values in the interval [-1, 1].
        return 70 * (n0 + n1 + n2);
    }

    /**
     * 2D perlin noise function
     * @param {Number} x
     * @param {Number} y
     * @returns The noise value
     */
    perlin2(x, y) {
        // Determine grid cell coordinates.
        let X = Math.floor(x);
        let Y = Math.floor(y);
        // Relative coordinates within that cell.
        x = x - X;
        y = y - Y;
        X &= 255;
        Y &= 255;

        const n00 = this.gradP[X + this.perm[Y]].dot2(x, y);
        const n01 = this.gradP[X + this.perm[Y + 1]].dot2(x, y - 1);
        const n10 = this.gradP[X + 1 + this.perm[Y]].dot2(x - 1, y);
        const n11 = this.gradP[X + 1 + this.perm[Y + 1]].dot2(x - 1, y - 1);

        const u = this.fade(x);
        return this.lerp(
            this.lerp(n00, n10, u),
            this.lerp(n01, n11, u),
            this.fade(y)
        );
    }
}

