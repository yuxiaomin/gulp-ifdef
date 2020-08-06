class Example {
    a() {
        /// #if A
        console.log('a');
        /// #endif

        /// #if B
        console.log('b');
        /// #endif
        /// #endif
    }
}
