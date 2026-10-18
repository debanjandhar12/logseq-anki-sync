import micropip

await micropip.install(["sympy==1.14.0", "mpmath==1.4.1"])

from sympy import Symbol, integrate, latex

x = Symbol("x")
result = integrate(x**2, x)
print(result)
print(latex(result))
