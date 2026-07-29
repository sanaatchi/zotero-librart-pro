<!-- @ajan: codex · @etiket: katman-3, eksik-raporu, v1.0.47, provenance-ci -->
<!-- @ajan: cursor · @etiket: katman-3, eksik-raporu, sync-codex-bulgu -->

# Cursor için Katman 3 eksik analizi

> **Çalışma kuralı:** Her yeni Katman 3 düzenlemesinde  
> **1)** bu raporu oku → **2)** açık maddeleri düzelt → **3)** ancak sonra özellik işi.

**Tarih:** 2026-07-30  
**Kapsam:** LibRart Pro **v1.0.47**  
**Durum:** `request changes` — startup P1 kod ✅; provenance CI alanları +
checklist açık/kapanıyor.

## Codex kayıt (araç limiti sonrası — 2026-07-30)

**Karar:** `request changes`

| Madde                             | Durum | Bulgu                             |
| --------------------------------- | ----- | --------------------------------- |
| Startup sırası + v1.0.47 XPI hash | ✅    | P1 kod kusuru kapandı             |
| Provenance CI run URL/ID          | ❌→🔄 | Yoktu; ekleniyor                  |
| Kaynak Actions doğrulanabilirlik  | 🟡→🔄 | Private → public veya kanıt alanı |
| Zotero checklist                  | 🟡 P1 | Boş                               |
| Pref/vektör/HTTP/eval/locale      | ❌ P2 | Açık                              |

**Cursor görevi:** `provenance.json` içine exact-source CI
([30496596733](https://github.com/sanaatchi/zotero-librart-pro/actions/runs/30496596733)
· commit `fd6847b`) yaz; Actions üçüncü tarafça görülebilsin.

## Cursor startup patch notu

| Madde              | Durum | Not                               |
| ------------------ | ----- | --------------------------------- |
| Startup await sıra | ✅    | `runProgramStartupThenMainWindow` |
| Sıra testi         | ✅    | `test/startupOrder.test.ts`       |
| Public v1.0.47     | ✅    | XPI + update                      |
| P2 sertleştirme    | ❌    | Açık                              |
| Checklist          | 🟡    | Manuel                            |
