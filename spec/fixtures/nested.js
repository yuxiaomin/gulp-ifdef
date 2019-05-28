class Example {
    run() {
        /// #if A
        console.log("A is enabled");
        /// #if B
        console.log("A+B");
        /// #else
        console.log("A-B");
        /// #if C
        console.log("A-B+C");
        /// #else
        console.log("A-B-C");
        /// #endif
        /// #endif
        /// #else
        console.log("A is disabled");
        /// #if C
        console.log("this stuff won't matter");
        /// #endif
        /// #endif

        /// #if C
        console.log("this stuff will");
        /// #endif

        /// #if B
        console.log("not this stuff");
        /// #endif
    }
}
