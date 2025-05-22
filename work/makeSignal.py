"""
pour creer n lignes d un signan
"""
import sys,random
n = int(sys.argv[1])
N=1
for i in range(n):
        N *= 2
# print(f"# {N=}")
f = open("exampleSignal","w")
for _ in range(N):
        x = random.random()
        f.writelines("%12.10lf\n"%x)
f.close()
print(f.name + " closed")




