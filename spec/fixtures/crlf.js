class Example {
    run() {
        console.log('Hello World');
        /// #if DEBUG
        console.log('Debugging on');
        /// #else
        console.log('Debugging off');
        /// #endif
        console.log('Goodbye');
    }

    a() {
        /// #if A
        console.log('a');
        /// #endif
    }
}
