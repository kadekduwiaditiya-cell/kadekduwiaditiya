# keuanganku

website personal finance untuk:
- total gaji
- alokasi gaji
- pengeluaran harian
- target keuangan
- import otomatis dari telegram bot
- cloudflare worker
- firebase firestore

## alur otomatis

telegram -> cloudflare worker -> firebase firestore -> website

contoh pesan telegram:
- makan 25k
- grab 18.000
- beli pulsa 50 ribu
- tabungan 500k

worker akan mengubah pesan menjadi transaksi dengan tanggal, nominal, keterangan, kategori, source, dan id telegram.

## firebase

1. buat firebase project.
2. aktifkan authentication > anonymous.
3. buat firestore database.
4. buat web app dan masukkan config-nya ke `firebase.js`.
5. buat service account untuk akses firestore dari cloudflare worker.
6. simpan credential service account hanya di cloudflare secrets.

Firebase mendukung modular web SDK dan anonymous authentication untuk aplikasi web. Cloudflare Workers menyediakan Web Crypto untuk operasi tanda tangan/verifikasi. 

## cloudflare

tambahkan variables/secrets:
- TELEGRAM_BOT_TOKEN
- TELEGRAM_CHAT_ID
- FIREBASE_PROJECT_ID
- GCP_CLIENT_EMAIL
- GCP_PRIVATE_KEY

deploy dengan wrangler, lalu set webhook telegram ke:
`https://NAMA-WORKER.workers.dev/telegram/webhook`

set `window.KEUANGANKU_API_URL` di `config.js` ke URL worker.

## keamanan

jangan pernah memasukkan token telegram atau private key service account ke github. frontend hanya menyimpan firebase web config; private credential tetap di cloudflare secrets.

## catatan

tanpa Firebase config dan URL Worker, website tetap bisa dipakai secara lokal menggunakan localStorage. Setelah config dipasang, transaksi dari telegram dapat masuk melalui Worker dan dibaca kembali oleh dashboard.