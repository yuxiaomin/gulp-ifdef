class Example {
    a() {
        /// #if A
        console.log('a');
        /// #else
        console.log('b');
        /// #else
        console.log('c');
        /// #endif
    }
}
