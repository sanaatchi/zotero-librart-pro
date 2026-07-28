# Claude Code — Git commit prompt

Bu dosyayı Claude Code’a vererek commit yaptır.

---

Bu proje Zotero eklentisi: **Eylemler ve Etiketler** (`eylemler-ve-etiketler`).

## Plugin nedir?

Zotero için “Actions and Tags” tabanlı özel fork.

- Eylemlerle öğelere otomatik etiket ekleme / kaldırma / aç-kapa
- **Etiket Analizi** paneli: kütüphane etiketlerini canlı analiz eder (istatistik, tür dağılımı, birleştirme adayları)
- Türkçe arayüz
- Otomatik güncelleme: public repo `sanaatchi/eylemler-ve-etiketler-releases`
- Kaynak (private): `sanaatchi/eylemler-ve-etiketler`
- Addon ID: `zoterotag@euclpts.com`
- Yayın: `npm run gh-release` (XPI + `update.json`)

## Git commit kuralları (Windows PowerShell)

1. ASLA `git config` değiştirme (global/local `user.name` / `user.email` ayarlama).
2. Commit öncesi paralel çalıştır:
   - `git status`
   - `git diff` ve `git diff --cached`
   - `git log -5 --oneline`
3. Sadece ilgili dosyaları stage et: `git add <dosyalar>`
   - `.env`, secret, credentials stage etme
4. Commit mesajını PowerShell heredoc ile ver (bash `<<EOF` değil):

```powershell
$env:GIT_AUTHOR_NAME = "ibrahimyildiz.art"
$env:GIT_AUTHOR_EMAIL = "ibrahimyildiz.art@gmail.com"
$env:GIT_COMMITTER_NAME = $env:GIT_AUTHOR_NAME
$env:GIT_COMMITTER_EMAIL = $env:GIT_AUTHOR_EMAIL

git commit -m @"
Kısa özet (neden).

"@
```

Not: Bu repoda bazen git identity yok; bu yüzden commit’ten hemen önce AUTHOR/COMMITTER env var set et. `git config` kullanma.

5. Commit sonrası: `git status` ile doğrula.
6. Hook fail olursa amend yapma; düzeltip **yeni** commit at.
7. Push sadece kullanıcı isterse: `git push origin HEAD`
8. Zotero’yu kullanıcı izni olmadan kapatma (`Stop-Process` / `taskkill` yasak).

## Bu oturumda

Değişiklikleri incele, anlamlı Türkçe veya İngilizce 1–2 cümlelik mesaj yaz, env identity ile commit et, status göster.  
Push etme (istenmedikçe).
