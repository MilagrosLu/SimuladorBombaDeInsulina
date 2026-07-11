# Simulador de Bomba de Insulina (PID Control Loop) - Medtronic MiniMed™ 780G

Este proyecto es un simulador interactivo de control de lazo cerrado  basado en la bomba de insulina Medtronic MiniMed™ 780G. Implementa un **Controlador PID** en un entorno web con un frontend en **React (Vite)** y un motor de simulación matemático en el backend usando **Go**.

---
### Proyecto Ya desplegado
Link al simulador ya desplegado para usar: https://simulador-bomba-de-insulina.vercel.app/

### Para correrlo local

## Herramientas a instalar

Para poder correr este proyecto desde cero se deben instalar dos herramientas fundamentales:

1. **Node.js** (Para correr y compilar el Frontend)
2. **Go** (Para correr el Backend)

### 1. Instalar Node.js

- **Windows / Mac:** Descarga el instalador oficial desde [nodejs.org](https://nodejs.org/) (se recomienda la versión **LTS**).
- **Linux (Ubuntu/Debian):**
  ```bash
  sudo apt update
  sudo apt install nodejs npm
  ```
- *Para verificar que se instaló correctamente, abre una terminal y ejecuta `node -v` y `npm -v`.*

### 2. Instalar Go

- **Windows / Mac:** Descarga el instalador oficial desde [go.dev/dl/](https://go.dev/dl/).
- **Linux (Ubuntu/Debian):**
  ```bash
  sudo apt update
  sudo apt install golang-go
  ```
- *Para verificar, ejecuta `go version` en tu terminal.*

---

## Instalación y Puesta en Marcha

Una vez que Node.js y Go estan instalados:

### Paso 1: Clonar / Descargar el repositorio


### Paso 2: Preparar el Frontend
Abre una terminal en la **raíz del proyecto** (donde está el archivo `package.json`) y ejecuta:
```bash
npm install
```
*Esto descargará todas las librerías necesarias para la interfaz gráfica (React, Chart.js, etc).*

### Paso 3: Preparar el Backend
Abre **otra terminal** y navega a la carpeta `backend/`:
```bash
cd backend
go mod tidy
```
*Esto descargará las dependencias de Go (como la librería de WebSockets `gorilla/websocket`).*

---

## Cómo ejecutar el Simulador

### 1. Iniciar el Backend (Motor de Simulación)
En la terminal que abriste en la carpeta `backend/`, ejecuta:
```bash
go run .
``

### 2. Iniciar el Frontend (Interfaz de Usuario)
En la terminal que tienes en la **raíz del proyecto**, ejecuta:
```bash
npm run dev
```

---


