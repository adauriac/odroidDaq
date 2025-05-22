#!/bin/bash

# node cmpPyJs.js
if [ "$#" -ne 3 ]; then
    echo "syntax: cmpPyJs.sh sizeOfData [f/w] freqSampling "
    echo "create a random signal of size 2**sizeOfData and perform a welch or fft xform."
    echo "for the welch case the last argument is the frequency sampling"
    exit 1
fi

echo "generating signal in the file exampleSignal"
python3 makeSignal.py $1

echo "performing transformation"
cmdj="node cmpPyJs.js $2 $3"
cmdp="python3 cmpPyJs.py $2 $3"
$cmdj | tee tmpjs
$cmdp | tee tmppy
echo ""
echo ""
echo "# Resume"
echo "# frequence javascript python (les freq sont bien les memes)"
if [ "$2" = "w" ]; then
    paste tmpjs tmppy | grep -v \# | gawk '{if (($1!=$4) || ($2!=$5)) print("MERDE"); else printf("%15.10lf %15.10lf %15.10lf  %s\n",$2,$3,$6,($3-$6)**2>1e-12 ? "*": " ")}'
else
    paste tmpjs tmppy | grep -v \# | gawk '{if (($1!=$5) || ($2!=$6)|| ($3!=$7) || ($4!=$8)) print($0);}'
fi


# 1        2               3                     4           5             6                 7            8
# 1 0.40684874900301315 0.5361676987000197 1.399406748259827 1 0.40684874900301315 0.5361676987000197 1.399406748259827
   
