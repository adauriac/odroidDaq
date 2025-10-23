const globals = {
    verboseThresholdGlobal: 11,
    JC: 1,
    consolelog(message, verbose = Number.MAX_SAFE_INTEGER - 1) {
        if (verbose >= globals.verboseThresholdGlobal) {
            console.log(message);
        }
    },
};

export default globals;
export const { consolelog } = globals;
