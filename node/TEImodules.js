// Module parameters
// definitions des parametres et commandes des differentes modules d'acquisitio Trenz

const TEI = [
    {         'ID':0 },
    {        'ID': 1, 'module': 'TEI0015 - 2 MS', 'featuresSpanComHighZ': true,
        'AdcSamplingRate' : 2000000, 'voltageRef': 10, 'AdcResolution': 18, 'AdcTreshold' : 131052,
        'gain 1': 1, 'gain 2': 2, 'gain 4': 4, 'gain 8': 8,
        'gainList' : [1, 2, 4, 8]
    },
    {        'ID': 2, 'module': 'TEI0016A - 0.5 MS', 'featuresSpanComHighZ': false,
        'AdcSamplingRate': 500000, 'voltageRef': 10, 'AdcResolution': 16, 'AdcTreshold': 32763,
        'gain 1': 1, 'gain 2': 2, 'gain 4': 4, 'gain 8': 8,
        'gainList': [1, 2, 4, 8]
    },
     {        'ID': 3, 'module': 'TEI0016B - 1 MS', 'featuresSpanComHighZ': false,
        'AdcSamplingRate': 1000000, 'voltageRef': 10, 'AdcResolution': 16, 'AdcTreshold': 32763,
        'gain 1': 1, 'gain 2': 2, 'gain 4': 4, 'gain 8': 8,
        'gainList': [1, 2, 4, 8]
    },
     {        'ID': 4, 'module': 'TEI0023A - 2 MS', 'featuresSpanComHighZ': true,
        'AdcSamplingRate': 2000000, 'voltageRef': 11, 'AdcResolution': 18, 'AdcTreshold': 131071,
        'gain 0.25': 1, 'gain 0.5': 2, 'gain 1': 3, 'gain 2': 4, 'gain 4': 5, 'gain 8': 6, 'gain 16': 7,
        'gainList': [0.25, 0.5, 1, 2, 4, 8, 16]
    },
     {        'ID': 5, 'module': 'TEI0023B - 1.8 MS', 'featuresSpanComHighZ': true,
        'AdcSamplingRate': 1800000, 'voltageRef': 11, 'AdcResolution': 20, 'AdcTreshold': 524287,
        'gain 0.25': 1, 'gain 0.5': 2, 'gain 1': 3, 'gain 2': 4, 'gain 4': 5, 'gain 8': 6, 'gain 16': 7,
        'gainList': [0.25, 0.5, 1, 2, 4, 8, 16]
    }
]
/*131052*/
function getModule( id) {
    return TEI[id]
}

module.exports ={ getModule : getModule }