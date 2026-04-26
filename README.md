# Mezon Vocab Bot 📚

Bot học từ vựng tiếng Anh chạy trên [Mezon](https://mezon.ai), được xây dựng bằng **NestJS**, **Prisma**, **Neon Postgres** và deploy trên **Railway**.

## ✨ Tính năng

- `!word` — Bốc một từ ngẫu nhiên (theo chủ đề bạn đã chọn) kèm IPA, nghĩa Anh-Việt và ví dụ.
- `!translate <từ>` — Tra nghĩa nhanh. Ưu tiên dataset nội bộ, fallback sang [Free Dictionary API](https://dictionaryapi.dev) nếu không có.
- `!quiz` — Sinh câu trắc nghiệm 4 đáp án (nghĩa Anh→Việt hoặc Việt→Anh).
- `!answer A|B|C|D` — Nộp đáp án cho quiz đang mở.
- `!topic <tên>` — Đổi chủ đề học (`common`, `business`, `travel`, `tech`, ...).
- `!topics` — Liệt kê chủ đề có sẵn.
- `!me` — Xem thống kê cá nhân (số câu trả lời, độ chính xác, streak).
- `!streak` — Số ngày học liên tiếp.
- `!help` — Trợ giúp.

Có thể đổi prefix `!` qua biến môi trường `BOT_PREFIX`.

## 🧱 Stack

| Thành phần | Công nghệ |
|---|---|
| Runtime | Node.js 20+ |
| Backend | NestJS 10 |
| ORM / DB | Prisma + Postgres ([Neon](https://neon.tech)) |
| Bot SDK | [`mezon-sdk`](https://www.npmjs.com/package/mezon-sdk) |
| Deploy | Railway (Dockerfile) |
| Translate fallback | [Free Dictionary API](https://dictionaryapi.dev) |

## 🚀 Bắt đầu nhanh (local)

### 1. Clone & cài deps

```bash
git clone <your-repo-url>
cd mezon-vocab-bot
npm install
```

### 2. Tạo Mezon Bot

1. Đăng nhập [https://mezon.ai](https://mezon.ai) và mở [Developer Portal](https://mezon.ai/developers).
2. Tạo `New Application` → kiểu `Create a bot` → đặt tên → `Create`.
3. Lấy **Bot ID** và **Bot Token** ở trang General Information.
4. Vào tab **Installation**, copy install link và dùng để mời bot vào clan.

Chi tiết: [docs.mezon.ai](https://mezon.ai/docs/developer/quick-start/creating-mezon-bot).

### 3. Tạo Neon database

1. Tạo project ở [https://neon.tech](https://neon.tech).
2. Copy connection string (kèm `?sslmode=require`).

### 4. Cấu hình env

```bash
cp .env.example .env
# Mở .env, điền MEZON_BOT_ID, MEZON_BOT_TOKEN, DATABASE_URL
```

### 5. Migrate & seed

```bash
npx prisma migrate deploy        # tạo schema trên Neon
npm run db:seed                  # seed ~80 từ vựng mẫu
```

Lần đầu phát triển, dùng `npx prisma migrate dev --name init` để tạo migration mới.

### 6. Chạy

```bash
npm run start:dev
```

Bot sẽ login vào Mezon. Vào clan đã mời bot và gõ `!help`.

## ☁️ Deploy lên Railway

1. Tạo project trên [Railway](https://railway.com), connect repo này.
2. Railway sẽ tự nhận `Dockerfile` và `railway.json`.
3. Thêm các biến môi trường:
   - `MEZON_BOT_ID`
   - `MEZON_BOT_TOKEN`
   - `DATABASE_URL` (Neon connection string)
   - `BOT_PREFIX` (tùy chọn, mặc định `!`)
   - `PORT` (Railway tự inject; mặc định 3000)
4. Deploy. Container sẽ tự chạy `prisma migrate deploy` trước khi start.
5. Sau lần deploy đầu, vào shell Railway hoặc chạy job để seed:

   ```bash
   npm run db:seed
   ```

Endpoint health: `GET /health` → `{ status: "ok" }` (Railway dùng để health-check).

## 📂 Cấu trúc

```
src/
  main.ts                  # bootstrap NestJS
  app.module.ts            # root module
  health.controller.ts     # GET /health for Railway
  prisma/                  # PrismaService (singleton)
  mezon/                   # MezonClient wrapper (singleton, login on boot)
  user/                    # UserService (find/create + streak)
  vocab/                   # VocabService + DictionaryService (Free Dictionary fallback)
  quiz/                    # QuizService (build/grade questions)
  bot/                     # BotService (subscribe to onChannelMessage) + CommandHandler
prisma/
  schema.prisma            # Word, User, UserProgress, QuizSession, QuizQuestion
  data/words.json          # ~80 từ TOEIC/IELTS mẫu
  seed.ts                  # upsert vào DB
```

## 🧠 Mở rộng

- Thêm từ: edit `prisma/data/words.json` và chạy `npm run db:seed` (script dùng `upsert`, an toàn để chạy lại).
- Thêm chủ đề: chỉ cần đặt `topic` mới trong JSON.
- SRS / Spaced Repetition: schema đã có `UserProgress.boxLevel` và `nextReviewAt`. Hook vào `submitAnswer` để cập nhật và viết lệnh `!review`.
- Daily word tự động post: cron đã sẵn (`@nestjs/schedule`). Đăng ký `@Cron(...)` trong một service mới và dùng `client.channels.fetch(...).send(...)`.

## 📝 License

MIT
