# 🏖️ Skill: Sunbeam Content Crafter

**Mục đích:** Tự động crawl nội dung từ một URL bất kỳ, phân tích và viết lại thành bài blog mới theo đúng phong cách Sunbeam Homestay.

**Cách kích hoạt:**
> hãy crawl [URL] và tạo bài viết mới cho tôi

---

## 1. Quy Trình Tổng Quan (6 Bước)

| Bước | Tên | Mô tả |
|:----:|-----|-------|
| 1 | **CRAWL** | Dùng Playwright MCP lấy text + ảnh từ URL gốc |
| 2 | **PHÂN TÍCH** | Xác định loại bài, trích xuất ý chính, số liệu |
| 3 | **REWRITE** | Viết lại nội dung theo style Sunbeam |
| 4 | **ẢNH** | Chọn ảnh phù hợp, giữ nguyên URL gốc |
| 5 | **TẠO FILE** | Sinh file `.md` trong `source/_posts/` |
| 6 | **VERIFY** | Kiểm tra checklist trước khi hoàn tất |

---

## 2. CRAWL – Hướng Dẫn Chi Tiết

### 2.1 Các Bước Thực Hiện

1. `playwright_browser_navigate` đến URL cần crawl
2. `playwright_browser_wait_for` đợi trang load xong (`time=3`)
3. **`playwright_browser_evaluate` chạy script scroll toàn trang** (mục 2.2.1) để kích hoạt lazy-load ảnh
4. `playwright_browser_evaluate` chạy script JS extract (mục 2.2.2) để trích xuất dữ liệu
5. Nhận về object JSON chứa: `title`, `content`, `images`, `lists`, `h1`, `h2`
6. **Kiểm tra số lượng ảnh ≥ số H2 section** — nếu thiếu, scroll lại và extract lại

### 2.2 Script JS Dùng Với evaluate()

#### 2.2.1 Script scroll toàn trang (kích hoạt lazy-load)

```javascript
async () => {
  const distance = 500;
  const delay = (ms) => new Promise(r => setTimeout(r, ms));
  let totalHeight = 0;
  const scrollHeight = document.body.scrollHeight;
  while (totalHeight < scrollHeight) {
    window.scrollBy(0, distance);
    totalHeight += distance;
    await delay(800);
  }
  window.scrollTo(0, 0);
  await delay(500);
  return 'Scrolled full page';
}
```

#### 2.2.2 Script extract nội dung

```javascript
() => {
  const getText = (el) => el?.textContent?.trim() || '';
  const main = document.querySelector('article, main, [role="main"], .post-content, .entry-content, .content, .single-content');
  const container = main || document.body;

  const h1s = [...container.querySelectorAll('h1')].map(getText).filter(Boolean);
  const h2s = [...container.querySelectorAll('h2')].map(getText).filter(Boolean);

  const images = [...container.querySelectorAll('img')]
    .filter(img => img.naturalWidth > 100 && img.naturalHeight > 100)
    .filter(img => !img.src.match(/logo|avatar|icon|banner|ads|pixel|tracking|placeholder/i))
    .filter(img => img.src || img.dataset.src)
    .map(img => ({
      src: img.src || img.dataset.src || '',
      alt: img.alt || '',
      width: img.naturalWidth,
      height: img.naturalHeight
    }));

  const paragraphs = [...container.querySelectorAll('p')]
    .map(getText)
    .filter(p => p.length > 30 && !p.match(/quảng cáo|sponsored|đặt phòng ngay|xem thêm|bình luận|footer/i));

  const lists = [...container.querySelectorAll('li')]
    .map(getText)
    .filter(l => l.length > 10);

  return {
    title: document.title || '',
    h1: h1s,
    h2: h2s,
    content: paragraphs.join('\n\n'),
    images: images.slice(0, 20),
    lists: lists.slice(0, 30),
    url: location.href
  };
}
```

### 2.3 Lọc Noise

Loại bỏ những nội dung:
- Đoạn text < 30 ký tự
- Phần chứa từ khóa: `quảng cáo`, `sponsored`, `đặt phòng ngay`, `xem thêm`, `bình luận`, `đánh giá`, `footer`
- Ảnh < 100x100px hoặc chứa `logo`, `avatar`, `banner`, `ads`, `pixel`, `tracking`, `placeholder` trong URL
- Ảnh hotel / booking thumbnail nhỏ (width/height < 300) — chỉ giữ ảnh nội dung chính

### 2.4 Kiểm Tra Số Lượng Ảnh Sau Crawl

Sau khi crawl xong, đếm số ảnh nội dung chính (bỏ qua thumbnail, icon, quảng cáo):
- **Số ảnh phải ≥ số H2 section** trong bài
- Nếu thiếu → scroll lại từ đầu với tốc độ chậm hơn (delay 1200ms) → extract lại
- Nếu vẫn thiếu: giữ lại số ảnh có được, phân bổ ưu tiên cho các section quan trọng nhất

---

## 3. PHÂN TÍCH – Phân Loại Bài Viết

Dựa vào nội dung crawl được, xác định loại bài:

| Loại bài | Dấu hiệu nhận biết | Category | Thư mục |
|----------|-------------------|----------|---------|
| **Travel Guide** | Hướng dẫn địa điểm, lịch trình, "kinh nghiệm", "khám phá", "hướng dẫn" | `Trải Nghiệm` | `trai-nghiem/` |
| **Top List** | "top N", danh sách đánh số, "những", "các" | `Ẩm Thực` (món ăn) hoặc `Trải Nghiệm` (địa điểm) | `am-thuc/` hoặc `trai-nghiem/` |
| **Review** | Đánh giá chỗ ở, sao ★, "review" | `Review Airbnb` hoặc `Review Agoda` | `review-airbnb/` hoặc `review-agoda/` |
| **Event/Seasonal** | Lễ hội, mùa, "giáng sinh", "tết", "hè", "giao thừa" | Không có | Thư mục gốc |
| **Promotional** | Giới thiệu homestay, tiện ích, giá, mẹo mua sắm | Không có | Thư mục gốc |

---

## 4. REWRITE – Quy Tắc Viết Lại

### 4.1 Kỹ Thuật Thay Đổi Nội Dung

| Kỹ thuật | Cách làm | Ví dụ |
|----------|---------|-------|
| **Đảo cấu trúc** | Sắp xếp lại thứ tự các section | Bài gốc A→B→C → bài mới B→C→A |
| **Từ đồng nghĩa** | Thay từ nhưng giữ nghĩa | `tuyệt vời` → `tuyệt hảo`, `đẹp` → `tuyệt mỹ`, `ngon` → `hấp dẫn` |
| **Gộp / tách câu** | 1 câu dài → 2 câu ngắn hoặc ngược lại | |
| **Đổi góc nhìn** | Góc nhìn khách → góc nhìn chủ homestay / local | `Du khách nên đến...` → `Mình gợi ý bạn nên ghé...` |
| **Thêm chi tiết** | Bổ sung context: gần Sunbeam, tiện ích homestay, view biển từ phòng | |

### 4.2 Dữ Liệu GIỮ NGUYÊN (Tuyệt Đối Không Thay Đổi)

- **Địa chỉ:** Chung cư 22 tầng, 165A Thùy Vân, Thắng Tam, Vũng Tàu
- **SĐT:** `0326130505`
- **Email:** `sunbeam.homestay.vt@gmail.com`
- **Website:** `sunbeamhomestay.com`
- **Facebook:** `http://www.facebook.com/sunbeamhomestay`
- **Instagram:** `https://www.instagram.com/sunbeam.homestay`
- **Agoda:** `https://www.agoda.com/vi-vn/seaview-50m-from-beach-2-bedrooms-bluesea/hotel/vung-tau-vn.html`
- **Airbnb:** `https://airbnb.com/h/sunbeam-homestay`
- **Giá cả, số liệu, tên riêng, địa danh, tên quán, tên món** từ bài gốc — giữ chính xác 100%

### 4.3 Style Tiếng Việt

| Yếu tố | Quy tắc |
|--------|---------|
| **Ngôn ngữ** | 90% tiếng Việt, 10% tiếng Anh (brand name, slang: "chill", "check-in", "view") |
| **Xưng hô** | `mình` (người viết) – `bạn` (người đọc) |
| **Giọng văn** | Nhiệt tình, gần gũi, thân thiện như bạn bè chia sẻ |
| **Emoji** | Dùng nhiều trong heading và body, lặp lại ít nhất 1 lần / section |
| **Cảm thán** | Dùng dấu `!` hoặc `!!`, không lạm dụng `!!!` |
| **Slang cho phép** | `chill`, `sống ảo`, `healing`, `must-try`, `check-in`, `background`, `Vitamin Sea` |
| **Đoạn văn** | 2–4 câu / đoạn, không dài dòng |
| **Danh sách** | Dùng bullet `-` cho amenities, tips, đặc điểm |

### 4.4 Quy Tắc Viết Lại Title

Title là yếu tố quan trọng nhất cho SEO và thu hút click. **Không được copy nguyên title bài gốc.**

| Quy tắc | Chi tiết | Ví dụ |
|---------|----------|-------|
| **Không trùng bài gốc** | Viết lại hoàn toàn, không giữ nguyên cấu trúc hoặc từ khóa chính của title gốc | Gốc: `1001 lí do để Vũng Tàu xứng đáng...` → Mới: `Khám Phá 7 Điểm Đến...` |
| **Số cụ thể** | Dùng số khớp với nội dung thực tế (số section, số item trong bài) | `7 điểm đến`, `Top 10 quán cafe` |
| **Từ khóa SEO** | Luôn có `Vũng Tàu` + từ khóa chính của chủ đề + động từ du lịch | `khám phá Vũng Tàu`, `du lịch Vũng Tàu`, `Vũng Tàu có gì chơi` |
| **Brand name** | Nhắc `Sunbeam Homestay` khi có thể một cách tự nhiên | `– Ngay Gần Sunbeam Homestay` (dùng dấu gạch ngang, viết hoa) |
| **Emoji** | 1-2 emoji ở cuối title, chọn theo chủ đề bài viết | `🌊📸`, `🏖️✨`, `🍽️☕` |
| **Độ dài** | 40-80 ký tự, tối đa 100 ký tự (tràn mobile) | |
| **Động từ mạnh** | Mở đầu bằng động từ hành động để tạo kích thích | `Khám Phá`, `Bỏ Túi`, `Ghé Ngay`, `Đừng Bỏ Lỡ` |
| **Pattern chuẩn** | `[Động từ] + [Số] + [Chủ đề] + [Địa danh] + [Brand] + [Emoji]` | `Khám Phá 7 Điểm Đến Không Thể Bỏ Lỡ Khi Du Lịch Vũng Tàu – Ngay Gần Sunbeam Homestay 🌊📸` |
| **H1 đồng bộ** | Title trong front matter và H1 đầu bài phải giống hệt nhau, kể cả emoji | |

### 4.5 Emoji Theo Chủ Đề

| Chủ đề | Emoji gợi ý |
|--------|-------------|
| Biển / du lịch | 🌊 🏖️ 🌅 🌴 🗺️ 📸 🚗 🏍️ |
| Ẩm thực | 🍽️ 🦪 🍲 🥞 🍚 🍤 🍮 ☕ |
| Chỗ ở / tiện nghi | 🛏️ 🚿 🛋️ 🍳 🌐 🔒 |
| Lễ hội / mùa | 🎄 ✨ 🎆 🎉 🎊 |
| Dùng chung | ✨ 🌟 📍 💸 ⚠️ 📝 💯 |

---

## 5. TEMPLATE – Cấu Trúc Bài Viết

### 5.1 Travel Guide (Trải Nghiệm)

**Front matter:**
```yaml
---
title: [Tiêu đề với emoji] 🌊🏖️
date: YYYY-MM-DD HH:MM:SS
cover: [URL ảnh cover từ bài gốc]
categories:
  - [Trải Nghiệm]
tags: [tag1, tag2, tag3, ...]
---
```

**Nội dung:**
```markdown
# [Tiêu đề khớp front matter]

[Lead – 1 câu hỏi hoặc câu mở thân thiện, gọi "bạn"]

## [Section 1 – tiêu đề có emoji] 🏖️
[2–4 câu mô tả ngắn]
![Ảnh minh họa](url "title")

### [Sub-section – H3] ✨
[Nội dung chi tiết]
- **Tip 1:** mô tả
- **Tip 2:** mô tả

## [Section 2] 🌅
[Nội dung...]

---

🏡 **Sunbeam Homestay – Chung cư 22 tầng**
- 📍 Địa chỉ: 165A Thùy Vân, Thắng Tam, Vũng Tàu
- 📞 Điện thoại: 0326130505
- 📧 Email: sunbeam.homestay.vt@gmail.com
- 🌐 Website: [sunbeamhomestay.com](http://sunbeamhomestay.com)

🌊 **Sunbeam Homestay - hẹn gặp bạn tại Vũng Tàu!** 🌊

**Từ khóa:** keyword1, keyword2, keyword3, ...
```

### 5.2 Top List

**Front matter:**
```yaml
---
title: Top N [Chủ Đề] 📸✨
date: YYYY-MM-DD HH:MM:SS
cover: [URL ảnh cover]
tags: [tag1, tag2, ...]
sticky: true
---
```

**Nội dung:**
```markdown
### [Tiêu đề khớp front matter]

[Lead paragraph]

## 1. [Item 1] 🌟
![Ảnh](url "title")
[Mô tả 2–3 câu]
- **Địa chỉ:** ...
- **Giá:** ...

## 2. [Item 2] ✨
...

---

📞 **Liên Hệ Đặt Phòng:**
- 📍 Địa chỉ: 165A Thùy Vân, Thắng Tam, Vũng Tàu
- 📞 Điện thoại: 0326130505
- 🌐 Website: [sunbeamhomestay.com](http://sunbeamhomestay.com)

**Từ khóa:** ...
```

### 5.3 Review (Airbnb / Agoda)

**Front matter:**
```yaml
---
title: ★★★★★ [Tiêu đề] ([Tên khách])
date: YYYY-MM-DD HH:MM:SS
categories:
  - [Review Airbnb]  (hoặc Review Agoda)
---
```

**Nội dung:**
```markdown
# ★★★★★ [Tiêu đề] ([Tên khách])

[1 đoạn giới thiệu về trải nghiệm của khách]

![Ảnh](url "title")

## 🏠 Không Gian Phòng
- 🛏 **Phòng ngủ:** ...
- 🚿 **Phòng tắm:** ...
- 🍳 **Bếp:** ...

## 🌊 View & Vị Trí
[Mô tả ngắn, nhấn mạnh view biển và vị trí gần bãi]

## 💝 Cảm Nhận
[1–2 câu trích dẫn cảm nhận tích cực của khách]

📞 **Đặt phòng ngay:**
- 🌐 Airbnb: [link]
- 🌐 Agoda: [link]
```

### 5.4 Event / Seasonal

**Front matter:**
```yaml
---
title: [Tiêu đề sự kiện / mùa] 🎄✨
date: YYYY-MM-DD HH:MM:SS
cover: [URL ảnh]
tags: [tag1, tag2, ...]
sticky: true
---
```

**Nội dung:**
```markdown
[Lời chào mở đầu theo mùa / sự kiện]

## [Section 1] 🎉
[Không khí, hoạt động nổi bật mùa này ở Vũng Tàu]

## [Section 2 – Gợi ý Homestay] 🏖️
[Nhấn mạnh Sunbeam Homestay là lựa chọn lý tưởng]

---

📞 **Liên Hệ Đặt Phòng:**
- 📍 ...
- 📞 ...
- 🌐 ...

🌊 **Sunbeam Homestay - hẹn gặp bạn tại Vũng Tàu!** 🌊
```

---

## 6. ẢNH – Quy Tắc Xử Lý

### 6.1 Số Lượng Ảnh Theo Loại Bài

| Loại bài | Mỗi H2 section | Tổng tối đa |
|----------|:--------------:|:-----------:|
| Travel Guide | **≥ 1 ảnh / section** | 12 |
| Top List | **≥ 1 ảnh / item** | 15 |
| Review | 1–2 ảnh / bài | 2 |
| Event / Promotional | **≥ 1 ảnh / section** | 8 |

> ⚠️ **Quy tắc quan trọng:** Mỗi section H2 (hoặc mỗi item trong Top List) **bắt buộc có ít nhất 1 ảnh** minh họa. Không có section nào chỉ có text trần.

### 6.2 Quy Tắc Chung

| Quy tắc | Mô tả |
|---------|-------|
| **URL** | Giữ nguyên URL ảnh gốc, không download, không re-upload |
| **Định dạng** | `![alt text mô tả bằng tiếng Việt](url "title")` |
| **Alt text** | Phải chứa ít nhất 1 từ khóa SEO, mô tả đúng nội dung ảnh |
| **HTML `\<img\>`** | Chỉ dùng khi cần gallery ảnh chất lượng cao hoặc ảnh bắt buộc từ 500px |
| **Cover** | Dùng ảnh đầu tiên của bài gốc hoặc ảnh có kích thước > 800px |
| **Skip** | Bỏ qua ảnh < 100x100px, ảnh logo/avatar/icon/quảng cáo/placeholder, ảnh hotel thumbnail nhỏ (< 300px) |
| **Phân bổ** | Ảnh có alt text hoặc nội dung liên quan đến section nào → gán vào section đó. Ảnh không rõ chủ đề → gán vào section kế tiếp còn thiếu. |

---

## 7. VERIFY – Checklist Kiểm Tra

Trước khi kết thúc, kiểm tra từng mục:

- [ ] Front matter bắt đầu và kết thúc bằng `---`
- [ ] `date` đúng format `YYYY-MM-DD HH:MM:SS`, ngày hợp lệ
- [ ] `title` có emoji phù hợp, khớp với heading đầu bài
- [ ] **Title không trùng với title bài gốc** (khác từ, khác cấu trúc, khác format)
- [ ] Title có từ khóa SEO chính + động từ mạnh + độ dài 40–80 ký tự
- [ ] Cover URL tải được (test bằng browser nếu cần)
- [ ] Tất cả ảnh có alt text tiếng Việt, chứa từ khóa SEO
- [ ] **Mỗi section H2 có ít nhất 1 ảnh** (không section nào chỉ text trần)
- [ ] Không có internal link hỏng (không link đến bài khác trên site)
- [ ] `Từ khóa:` ở cuối bài khớp với `tags` trong front matter
- [ ] Thông tin liên hệ chính xác tuyệt đối (SĐT, địa chỉ, email)
- [ ] Social links (Facebook, Instagram, Agoda, Airbnb) đúng URL
- [ ] Emoji không bị lỗi encoding
- [ ] File được lưu đúng thư mục `source/_posts/[category]/`
- [ ] Tên file: tiếng Việt có dấu, phân cách bằng dấu gạch ngang, đuôi `.md`
- [ ] Chạy `npm run build` không báo lỗi

---

## 8. Ví Dụ Input → Output

### Input
```
URL: https://example.com/bai-viet-ve-bai-sau-vung-tau
```

### Bước 1: Crawl
```json
{
  "title": "Bãi Sau Vũng Tàu - Kinh nghiệm du lịch 2025",
  "h1": ["Bãi Sau Vũng Tàu - Kinh nghiệm du lịch 2025"],
  "h2": ["Giới thiệu", "Thời điểm đẹp nhất", "Các hoạt động"],
  "content": "Bãi Sau là một trong những bãi biển đẹp nhất Vũng Tàu...",
  "images": [
    { "src": "https://cdn.example.com/bai-sau-1.jpg", "alt": "", "width": 1200, "height": 800 },
    { "src": "https://cdn.example.com/bai-sau-2.jpg", "alt": "", "width": 1200, "height": 800 }
  ]
}
```

### Bước 2: Phân Tích
→ **Loại bài:** Travel Guide
→ **Category:** Trải Nghiệm
→ **Thư mục:** `trai-nghiem/`
→ **Tên file:** `kham-pha-bai-sau-vung-tau-thien-duong-bien-xanh.md`

### Bước 3–5: Output (Bài Viết Hoàn Chỉnh)

```markdown
---
title: Khám Phá Bãi Sau Vũng Tàu – Thiên Đường Biển Xanh Ngay Trung Tâm 🌊🏖️
date: 2026-05-31 10:00:00
cover: https://cdn.example.com/bai-sau-1.jpg
categories:
  - [Trải Nghiệm]
tags:
  [
    Bãi Sau Vũng Tàu,
    biển Vũng Tàu,
    du lịch Vũng Tàu,
    homestay Vũng Tàu,
    Sunbeam Homestay,
    khám phá Vũng Tàu,
    bãi biển Vũng Tàu,
    kinh nghiệm du lịch,
    du lịch biển,
    nghỉ dưỡng Vũng Tàu,
  ]
---

# Khám Phá Bãi Sau Vũng Tàu – Thiên Đường Biển Xanh Ngay Trung Tâm 🌊🏖️

Bạn đang tìm một bãi biển đẹp, sạch sẽ, ngay trung tâm Vũng Tàu để chill cuối tuần? Bãi Sau chính là câu trả lời hoàn hảo dành cho bạn!

## 🌅 Vì Sao Bãi Sau Luôn Là Điểm Đến Yêu Thích?

Nằm dọc theo con đường Thùy Vân thơ mộng, Bãi Sau sở hữu bờ cát dài hàng cây số, nước biển trong xanh và không khí trong lành. Đây là địa điểm lý tưởng cho những ai muốn tận hưởng kỳ nghỉ trọn vẹn bên gia đình và bạn bè.

![Toàn cảnh Bãi Sau Vũng Tàu](https://cdn.example.com/bai-sau-1.jpg "Toàn cảnh Bãi Sau Vũng Tàu nhìn từ trên cao")

### 🏖️ Những Trải Nghiệm Không Thể Bỏ Qua

- 🌊 **Tắm biển:** Nước trong xanh, sóng êm, an toàn cho cả trẻ nhỏ
- 🚴 **Đạp xe dọc bờ biển:** Con đường Thùy Vân rợp bóng dừa, cực kỳ thơ mộng
- 📸 **Sống ảo:** Background cực chất với bãi cát trắng mịn và hàng dừa xanh mát

## 🌴 Thời Điểm Đẹp Nhất Để Ghé Thăm

Theo kinh nghiệm của mình, Bãi Sau đẹp nhất vào buổi sáng sớm (5h–7h) để đón bình minh và buổi chiều (16h–18h) để ngắm hoàng hôn. Tránh đi vào giữa trưa nắng gắt nhé!

![Bình minh trên Bãi Sau](https://cdn.example.com/bai-sau-2.jpg "Bình minh tuyệt đẹp trên Bãi Sau Vũng Tàu")

---

🏡 **Sunbeam Homestay – Chung cư 22 tầng**
- 📍 Địa chỉ: 165A Thùy Vân, Thắng Tam, Vũng Tàu
- 📞 Điện thoại: 0326130505
- 📧 Email: sunbeam.homestay.vt@gmail.com
- 🌐 Website: [sunbeamhomestay.com](http://sunbeamhomestay.com)

🌊 **Sunbeam Homestay - hẹn gặp bạn tại Vũng Tàu!** 🌊

**Từ khóa:** Bãi Sau Vũng Tàu, biển Vũng Tàu, du lịch Vũng Tàu, homestay Vũng Tàu, Sunbeam Homestay, khám phá Vũng Tàu, bãi biển Vũng Tàu, kinh nghiệm du lịch, du lịch biển, nghỉ dưỡng Vũng Tàu
```

### Bước 6: Verify
→ Kiểm tra checklist → Đạt tất cả → Hoàn tất!
