---
name: project-readme-priority
description: >-
  Tu dong kich hoat khi nguoi dung yeu cau xem xet, phan tich, kham pha mot
  thu muc du an hoac ma nguon. Use this skill when the user asks to explore,
  review, analyze, understand, or navigate a project codebase or directory.
  This skill ensures the agent reads the README first and uses it as a mental
  map before diving into any code, config, or detail files.
---

# Project README Priority

## Muc tieu (Objective)

Truoc khi doc bat ky file code nao, **luon luon doc README truoc** de hieu toan bo kien truc du an. README la ban do tu duy (mental map) -- ap dung no de dinh huong moi buoc phan tich tiep theo.

---

## Quy trinh thuc hien (Step-by-Step Workflow)

### Buoc 1 - Tim README ngay lap tuc

1. Kiem tra thu muc goc cua du an (workspace root) cho cac file sau theo thu tu uu tien:
   - `README.md`
   - `readme.md`
   - `README.txt`
   - `README.rst`
   - `README`
2. Neu khong tim thay o thu muc goc, tim trong cac thu muc con quan trong (`docs/`, `frontend/`, `backend/`).
3. **KHONG doc code truoc khi hoan thanh buoc nay.**

### Buoc 2 - Trich xuat thong tin cot loi tu README

Doc README va trich xuat **5 nhom thong tin** sau:

| # | Nhom thong tin | Noi dung can tim |
|---|---|---|
| 1 | **Tong quan du an** | Muc dich, van de giai quyet, doi tuong nguoi dung |
| 2 | **Kien truc & So do thu muc** | Cau truc folder, vi tri frontend/backend/database/config |
| 3 | **Tech Stack** | Ngon ngu, framework, thu vien chinh, database, cloud services |
| 4 | **API & Routes** | Danh sach endpoints, duong dan URL, chuc nang tuong ung |
| 5 | **Cai dat & Chay ung dung** | Lenh cai dat, bien moi truong (.env), cach khoi dong dev/prod |

### Buoc 3 - Xay dung Mental Map

Sau khi doc README, tom tat cho chinh minh (va nguoi dung neu can):

```
PROJECT MENTAL MAP
==================
==> Du an: [ten va muc dich ngan gon]
==> Kien truc: [monolith / microservices / frontend+backend / ...]
==> Cau truc chinh:
   +-- [thu muc 1] --> [chuc nang]
   +-- [thu muc 2] --> [chuc nang]
   +-- [thu muc 3] --> [chuc nang]
==> Tech Stack: [danh sach cong nghe]
==> API Base: [URL hoac prefix chinh]
==> Khoi dong: [lenh chinh de chay]
```

### Buoc 4 - Dung Mental Map de dinh huong phan tich

Ap dung kien truc da trich xuat tu README lam **ban do chi dan** truoc khi:
- Doc bat ky file code nao (.js, .py, .ts, .java, v.v.)
- Mo file cau hinh (package.json, pom.xml, requirements.txt, v.v.)
- Phan tich database schema
- Tim kiem bug hoac hieu luong xu ly

Nguyen tac: **Luon biet minh dang dung o dau trong ban do** truoc khi di sau vao chi tiet.

---

## Xu ly truong hop dac biet

### README khong ton tai
1. Thong bao cho nguoi dung rang khong tim thay README.
2. Tu dong kiem tra cac file sau de tong hop thong tin tuong duong:
   - `package.json` (Node.js) --> ten, version, scripts, dependencies
   - `pyproject.toml` / `setup.py` (Python) --> package info
   - `pom.xml` (Java/Maven) --> project metadata
   - `docker-compose.yml` --> services va cau truc he thong
   - `Makefile` --> cac lenh chinh
3. Xay dung Mental Map tu cac file tren.

### README qua dai hoac phuc tap
1. Doc phan **dau** (overview/introduction) va **muc luc** truoc.
2. Uu tien cac section: `Installation`, `Usage`, `Architecture`, `API`, `Project Structure`.
3. Bo qua cac section: `Contributing`, `License`, `Changelog` (tru khi duoc yeu cau).

### Du an da repo (monorepo)
1. Doc README goc truoc.
2. Sau do doc README cua tung sub-package neu can di sau vao module do.

---

## Quy tac bat buoc (Mandatory Rules)

- KHONG BAO GIO bat dau doc code ma khong doc README truoc.
- LUON LUON tom tat Mental Map truoc khi tien hanh phan tich chi tiet.
- Neu nguoi dung hoi ve mot file cu the ma chua co context ve du an, hoi lai: "Ban co muon toi doc README de hieu kien truc truoc khong?"

---

## Vi du kich hoat (Trigger Examples)

Skill nay duoc kich hoat khi nguoi dung noi:
- "Phan tich du an nay cho toi"
- "Giup toi hieu codebase nay"
- "Explore the project directory"
- "Review this codebase"
- "Tim hieu kien truc cua project"
- "Toi vua clone mot repo, giup toi hieu no"
- "Explain the project structure"
- Bat ky yeu cau nao lien quan den kham pha, xem xet, hoac phan tich mot thu muc/du an.
