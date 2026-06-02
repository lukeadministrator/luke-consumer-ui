# Lukeflow — An orchestrator for better future

Lukeflow is the consumer UI for an orchestration platform, built on **React 19, Vite 6, TypeScript and Tailwind CSS v4**.

This is the starting point — we keep adding features as we go.

## Getting started

```bash
npm install
npm run dev      # start the dev server on http://localhost:5173
npm run build    # type-check + production build
npm run preview  # preview the production build
npm run lint     # run eslint
```

## Project structure

```
src/
├── App.tsx            # routes (react-router v7)
├── layout/            # sidebar, header, app shell
├── pages/             # Dashboard, Calendar, Forms, Tables, Charts, Auth…
├── components/        # ui, form, charts, tables, header widgets
├── context/           # theme & sidebar providers
├── hooks/  icons/     # custom hooks + SVG icon set
```

## Tech

- React 19 + React Router 7
- Vite 6
- TypeScript 5.7
- Tailwind CSS v4
- ApexCharts, FullCalendar, react-dnd, swiper

---

UI scaffolding based on [TailAdmin](https://tailadmin.com) (MIT licensed) — see `LICENSE.md`.
