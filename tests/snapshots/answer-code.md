哈喽嗨，亲爱的小仙女们，小伙子们！

作为一名爱分享、爱编程的程序员小哥哥 ‍ ，

Python是我的第二语言，对我的工作效率提升巨大。

我今天要给你们分享一份

超级实用的Python代码大合集！

让你在加班的路上越走越远，逆袭人生巅峰！

## 代码1：给照片加水印

```python3
from PIL import Image, ImageFont, ImageDraw


def watermark_Image(img_path, output_path, text, pos):
    image = Image.open(img_path)
    drawing = ImageDraw.Draw(image)
    black = (10, 5, 12)
    font_size = 50
    font = ImageFont.truetype('Arial.ttf', font_size)
    drawing.text(pos, text, font=font, fill=black)
    image.show()
    image.save(output_path)


img = 'source.jpeg'
watermark_Image(img, 'watermarked.jpeg', 'Python', pos=(100, 100))
```

![图片](https://pic1.zhimg.com/v2-e9feb549503290f4c67fec2eb3804258.jpg)

给照片加水印

## 代码2：修改照片的长和宽

```text
from PIL import Image


def img_resize(file, height, width):
    img = Image.open(file)
    resize = img.resize((height, width), )
    resize.save("resized.jpg", "JPEG", quality=100)


img_resize("source.jpeg", 100, 100)
```

![图片](https://pic1.zhimg.com/v2-c2b02ba8ea0fa5e25b55f441c1cc8a3e.jpg)

修改照片长和宽

## 代码3：将照片转PDF

```text
import os
import img2pdf

with open("test.pdf", "wb") as file:
    file.write(img2pdf.convert([i for i in os.listdir("文件路径") if i.endswith(".jpg")]))
```

![图片](https://picx.zhimg.com/v2-4b2e5317b2aa34670ef54333bb0cdd00.jpg)

将照片转PDF

## 代码4：获取图像主要颜色

```text
from PIL import Image

# 打开图片文件
image = Image.open("./star.jpeg")

# 模式P为8位深度图像
image_p = image.convert(
    "P", palette=Image.ADAPTIVE
)
# image_p.show()

# 以列表形式返回图像调色板
palette = image_p.getpalette()

# 图像中使用的颜色列表,maxcolors默认256
color_counts = sorted(image_p.getcolors(), reverse=True)

# 通过颜色列表查找到真正的颜色
colors = []
for i in range(5):
    palette_index = color_counts[i][1]
    dominant_color = palette[palette_index * 3: palette_index * 3 + 3]
    colors.append(tuple(dominant_color))

# 输出颜色
print(colors)
# [(204, 154, 86), (230, 237, 226), (213, 213, 212), (251, 238, 206), (82, 167, 204)]
for i, val in enumerate(colors):
    image.paste(val, (0 + i * 320, 0, 300 + i * 320, 300))

#  保存并显示图片
image.save("star2.jpg")
image.show()
```

![图片](https://picx.zhimg.com/v2-d16bb6f61f4c4a0822bb55dcaaf16961.jpg)

获取图像主要颜色

## 代码5：文件压缩

```text
import zipfile


# 压缩文件
def zipMyFile(file):
    with zipfile.ZipFile(file, 'w') as zf:
        zf.write('1.py')
        zf.write('2.py')
        zf.close()


zipMyFile('test.zip')
```

![图片](https://pic1.zhimg.com/v2-23a2c72b985751e37a6d9556cc569dc4.jpg)

文件压缩

## 代码6：测试网速

```text
from speedtest import Speedtest


def test_speed(network):
    print("开始测试网速，请等待")
    download = network.download()
    upload = network.upload()
    print(f'下载速度：{download / (1024 * 1024)} Mbps')
    print(f'上传速度：{upload / (1024 * 1024)} Mbps')
    print("测试完成")


speed = Speedtest()
test_speed(speed)
```

![图片](https://picx.zhimg.com/v2-4da9d5ee30081c86803ef7acc820a6ee.jpg)

测试网速

## 代码7：Emoji表情

```text
import emoji

result = emoji.emojize('Python is :thumbs_up:')
print(result)
# Python is  

result2 = emoji.demojize('Python is  ')
print(result2)
# Python is :partying_face:
```

![图片](https://pic1.zhimg.com/v2-5500f996c3d7f93eeeec08e10ee44a71.jpg)

Emoji表情

## 代码8：生成和解析二维码

```text
import qrcode
import cv2


# 生成二维码
def make_qrcode(content):
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=20,
        border=2
    )
    qr.add_data(content)
    qr.make(fit=True)
    image = qr.make_image(fill_color='black', back_color='white')
    image.save("qrcode.png")


# 解析二维码
def identify_qrcode(file):
    qr_image = cv2.imread(file)
    qr_detector = cv2.QRCodeDetector()
    data, bbox, straight_qrcode = qr_detector.detectAndDecode(qr_image)
    print(data)


make_qrcode("Hello Python")
identify_qrcode("qrcode.png")
```

![图片](https://picx.zhimg.com/v2-b0560ccbc97ac392a768f511939bc126.jpg)

生成和解析二维码

## 代码9：从视频中提取音频

```text
from moviepy.editor import VideoFileClip
import os

# 待转换的视频文件夹
file_path = '文件路径1'
# 转换后的音频文件夹
output_path = '文件路径2'

for root, dirs, files in os.walk(file_path):
    for f in files:
        video_file_path = os.path.join(root, f)
        if os.path.splitext(f)[1] == '.mp4':
            video = VideoFileClip(video_file_path)
            audio = video.audio
            file_name = os.path.splitext(f)[0] + '.wav'
            audio.write_audiofile(os.path.join(output_path, file_name))
```

![图片](https://picx.zhimg.com/v2-ce3fea833f6a69c6efab8f0bb7f1ba1a.jpg)

从视频中提取音频

## 代码10：简单网页应用

```text
from flask import Flask
app = Flask(__name__)


@app.route('/')
def index():
    return "Hello World, with Flask"


@app.route('/hello/<name>')
def hello(name):
    return "Hello %s" % name


if __name__ == '__main__':
    app.config['JSON_AS_ASCII'] = False
    # app.debug = True  # 设置调试模式，生产模式的时候要关掉debug
    app.run()
```

![图片](https://pic1.zhimg.com/v2-6645b938fe4873c2ae8692d684369696.jpg)

简单网页应用

以上就是我要分享的10个Python代码啦！

每一个都是精选中的精选

能极大提升你的工作效率

让你在编程的世界里所向披靡！

后面会继续分享Python爬虫教程，Python办公自动化等内容，对Python语言感兴趣的可以关注我哦
