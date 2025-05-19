# odroidDaq
for Neel institute

the welch transform was performed by a python script this was excessively slow
Since no welch transform is available in js, we will write a welch in js using a fft in js.
1. write a program in python performing a welch transform only using ONLY a fft transform.
   This is done in work/welchSimuleParFFT.py, we see perfect matching 
2. write a ftt in js completely compatible with the python (scipy.fft)
   This is done in work/TODO
3. Write the welch in js.

In python one use scipy, and in js github.com/indutny/fft.js/blob/master/README.md.
Note that this fft in js NEEDS a signal of size power of two.
See welch.lyx to understand how it works.
For some reason scipy.fft is not properly install on odroid, so I perform the check in the odroid directory mounted on a ubuntu machine
