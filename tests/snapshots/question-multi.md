设 $f(x)=\cos x+i\sin x$ ，则有 $f(0)=1,f'(x)=-\sin x+i\cos x=if(x)$ 。求解初值问题：

$$\begin{cases} f(0)=1 \\ f'(x)=if(x) \end{cases}$$

可得 $f(x)=e^{ix}$ ，又因为 $f(x)=\cos x+i\sin x$ ，所以 $e^{ix}=\cos x+i\sin x$

代入圆周率，得：

$$e^{i\pi}=-1\Rightarrow e^{i\pi}+1=0$$

---

哇 这个简单

你看f(x)=cos(x)+i\*sin(x)，求导得f'(x)=-sin(x)+i\*cos(x)=i\*f(x)

再看g(x)=e^(i\*x)，求导得g'(x)=i\*e^(i\*x)=i\*g(x)

又有f(0)=g(0)=1

因此f(x)=g(x)是显然的（光速逃

---

欧拉当年是这么推的：

首先cosx+isinx这个复数定义没问题吧？然后，cosx+isinx=(cos(x/n)+isin(x/n))^n, 这个也是高中学过的棣莫弗公式的简单推论。

当n－＞∞， cos(x/n)=1,sin(x/n)=x/n,这个简单，但

(cos(x/n)+isin(x/n))^n=（1+ix/n）^n（可以这样求极限？反正欧拉是这么求的~）

如果ix是实数，令n=m\***ix，按e的定义：（1+ix/n）^n=（1+1/m）^(m**\*ix)=e^(ix) ，就这么简单。

问题ix不是实数，但欧拉也就这么令了！那结果就只能这样了，惊不惊喜？意不意外？

不信请查欧拉的 《无穷分析引论》，有中文版。
