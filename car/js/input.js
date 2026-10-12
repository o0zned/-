const Input = {
    accelerate: false,
    brake: false,

    init(canvas) {
        const self = this;

        function evaluateTouches(touchList) {
            const rect = canvas.getBoundingClientRect();
            let acc = false;
            let brk = false;
            for (let i = 0; i < touchList.length; i++) {
                const localX = touchList[i].clientX - rect.left;
                if (localX < rect.width / 2) brk = true;
                else acc = true;
            }
            self.accelerate = acc;
            self.brake = brk;
        }

        canvas.addEventListener('touchstart', (e) => evaluateTouches(e.touches), { passive: true });
        canvas.addEventListener('touchmove', (e) => evaluateTouches(e.touches), { passive: true });
        canvas.addEventListener('touchend', (e) => evaluateTouches(e.touches), { passive: true });
        canvas.addEventListener('touchcancel', (e) => evaluateTouches(e.touches), { passive: true });

        let mouseDown = false;
        canvas.addEventListener('mousedown', (e) => {
            mouseDown = true;
            evaluateMouse(e);
        });
        window.addEventListener('mousemove', (e) => {
            if (mouseDown) evaluateMouse(e);
        });
        window.addEventListener('mouseup', () => {
            mouseDown = false;
            self.accelerate = false;
            self.brake = false;
        });
        function evaluateMouse(e) {
            const rect = canvas.getBoundingClientRect();
            const localX = e.clientX - rect.left;
            self.brake = localX < rect.width / 2;
            self.accelerate = !self.brake;
        }
    }
};
