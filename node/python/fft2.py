
import numpy as np
import time
from scipy import signal
import getopt,sys
import json

#json encoder for numpy types
class NumpyArrayEncoder(json.JSONEncoder):
    def default(self, obj):        
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        return json.JSONEncoder.default(self, obj)
        
# FFT en nV/Hz
# fft2.py

# Read data (signal temporel) from the Writable Stream
def read_in():
    lines = sys.stdin.readlines()
    return json.loads(lines[0])


def main():
    # Remove 1st argument from the
    # list of command line arguments
    # on doit passer fs(freq echantillons) et seg(segmentation) en arguments
    argumentList = sys.argv[1:]
    
    # Options
    options = "f:s:m:"
    try:
        # Parsing argument
        arguments, values = getopt.getopt(argumentList, options)   
        # checking each argument
        for currentArgument, currentValue in arguments:
            if currentArgument in ['-f']:
                fs = int(currentValue  )
            elif currentArgument in ['-s']:
                samples = int(currentValue)
            elif currentArgument in ['-m']:
                seg = int(currentValue)                
    except getopt.error as err:
        # output error, and return with an error code
        exit -1  
    
      # Store the data as an array in 'data_input'
    data_input = read_in()

    #conversion en tableau de float
    data=[]
    for d in data_input.values():
        data.append(float(d))
    sys.stderr.write('\nPY:fft2 ready fs =' + str(fs) + ' seg=' +str(seg) +' N='+ str(len(data)))
    sys.stderr.write('\nPY:data type:'+ str( type(data)) )
    nbperseg = samples *1024 /seg
    # FFT
    # segmentation p  seg=N//p
    #boxcar, triang, blackman, hamming, hann, bartlett, flattop, parzen, bohman, blackmanharris, nuttall, barthann
    f, Pxx_den = signal.welch(data, fs, 'hann',nperseg=nbperseg, scaling='density')
    
    P = np.sqrt(Pxx_den)
    # f et Pxx de type <ndarray>
    sys.stderr.write('\nPY:computed..')

     # Return the fft
    numpyData = {'fftx': f , "ffty": P} 
    sys.stdout.write(json.dumps(numpyData,  cls=NumpyArrayEncoder) )


    sys.stderr.write('\nPY:done')

# Start the process
if __name__ == '__main__':
    main()
