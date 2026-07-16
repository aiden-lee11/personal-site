// sceneGraph.js
// this file was created with the assistance of ChatGPT 5
// taken from my project 1
class SceneNode {
    constructor({ name = "", range = null, mode = null } = {}) {
        this.name = name;
        this.local = new Matrix4();
        this.world = new Matrix4();
        this.children = [];
        this.parent = null;

        this.range = range;     // { first, count }
        this.mode = mode;       // pass in from caller; fallback in render

        this.updater = null;    // (dt, self) => {}
    }

    add(child) { child.parent = this; this.children.push(child); return child; }
    setLocal(m) { this.local = m; return this; }
    translate(x, y, z) { this.local.translate(x, y, z); return this; }
    rotate(deg, x, y, z) { this.local.rotate(deg, x, y, z); return this; }
    scale(x, y, z) { this.local.scale(x, y, z); return this; }

    updateWorld(parentWorld, dt) {
        if (this.updater) this.updater(dt, this);
        this.world.set(parentWorld).multiply(this.local);
        for (const c of this.children) c.updateWorld(this.world, dt);
    }

    // NOTE: gl and the uniform location are passed in from the app
    render(gl, uModelRef, uInverseTransposeRef) {
        if (this.range) {
            gl.uniformMatrix4fv(uModelRef, false, this.world.elements);
            
            // Also set the inverse-transpose for proper normal transformation
            if (uInverseTransposeRef) {
                let inverseTranspose = new Matrix4().setInverseOf(this.world).transpose();
                gl.uniformMatrix4fv(uInverseTransposeRef, false, inverseTranspose.elements);
            }
            
            const mode = this.mode ?? gl.TRIANGLES; // safe fallback here
            gl.drawArrays(mode, this.range.first, this.range.count);
        }
        for (const c of this.children) c.render(gl, uModelRef, uInverseTransposeRef);
    }

    getPosition() {
        return new Vector3(this.world.elements.slice(12, 15));
    }
}

