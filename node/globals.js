const globals = {
    verboseThresholdGlobal: 11,
    consolelog(message, verbose = Number.MAX_SAFE_INTEGER - 1) {
        if (verbose >= globals.verboseThresholdGlobal) {
            console.log(message);
        }
    },
};

export default globals;
export const { consolelog } = globals;
