#!/bin/bash

# node cmpPyJs.js 
cmdj="node cmpPyJs.js $1 $2"
cmdp="python3 cmpPyJs.py $1 $2"
$cmdj | tee tmpjs
$cmdp | tee tmppy
echo ""
echo ""
echo "# Resume"
echo "# frequence javascript python (les freq sont bien les memes"
if [ "$1" = "w" ]; then
    paste tmpjs tmppy | grep -v \# | gawk '{if (($1!=$4) || ($2!=$5)) print("MERDE"); else printf("%lf %lf %lf\n",$2,$3,$6)}'
else
    paste tmpjs tmppy | grep -v \# | gawk '{if (($1!=$5) || ($2!=$6)|| ($3!=$7) || ($4!=$8)) print($0);}'
fi


# 1        2               3                     4           5             6                 7            8
# 1 0.40684874900301315 0.5361676987000197 1.399406748259827 1 0.40684874900301315 0.5361676987000197 1.399406748259827
   
