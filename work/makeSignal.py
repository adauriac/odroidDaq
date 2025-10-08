"""
pour creer n lignes d un signan
"""
import sys,random,math
n = int(sys.argv[1])
N=1
for i in range(n):
        N *= 2
# print(f"# {N=}")
w=0.5
f = open("exampleSignal","w")
for i in range(N):
        #x = random.random()
        x= math.cos(2*math.pi*w*i/N)
        f.writelines("%12.10lf\n"%x)
f.close()
print(f.name + " closed")




