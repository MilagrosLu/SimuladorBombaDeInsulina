# Simulador de Bomba de Insulina (PID Control Loop) - Medtronic MiniMed™ 780G

Este proyecto es un simulador interactivo de control de lazo cerrado  basado en la bomba de insulina Medtronic MiniMed™ 780G. Implementa un **Controlador PID** en un entorno web con un frontend en **React (Vite)** y un motor de simulación matemático en el backend usando **Go**.

---

## 🛠️ Requisitos Previos

Para poder correr este proyecto desde cero se deben instalar dos herramientas fundamentales:

1. **Node.js** (Para correr y compilar el Frontend)
2. **Go (Golang)** (Para correr el motor matemático del Backend)

### 1. Instalar Node.js

- **Windows / Mac:** Descarga el instalador oficial desde [nodejs.org](https://nodejs.org/) (se recomienda la versión **LTS**).
- **Linux (Ubuntu/Debian):**
  ```bash
  sudo apt update
  sudo apt install nodejs npm
  ```
- *Para verificar que se instaló correctamente, abre una terminal y ejecuta `node -v` y `npm -v`.*

### 2. Instalar Go (Golang)

- **Windows / Mac:** Descarga el instalador oficial desde [go.dev/dl/](https://go.dev/dl/).
- **Linux (Ubuntu/Debian):**
  ```bash
  sudo apt update
  sudo apt install golang-go
  ```
- *Para verificar, ejecuta `go version` en tu terminal.*

---

## 🚀 Instalación y Puesta en Marcha

Una vez que tengas Node.js y Go instalados, sigue estos pasos:

### Paso 1: Clonar / Descargar el repositorio
Si tienes Git instalado, puedes clonar el proyecto. Si no, simplemente descomprime el archivo `.zip` del proyecto y abre una terminal dentro de la carpeta principal (`Simulación`).

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

## ▶️ Cómo ejecutar el Simulador

Para que el simulador funcione, **ambos servicios (Frontend y Backend) deben estar corriendo al mismo tiempo**.

### 1. Iniciar el Backend (Motor de Simulación)
En la terminal que abriste en la carpeta `backend/`, ejecuta:
```bash
go run .
```

Verás un mensaje indicando que el servidor WebSocket está corriendo en el puerto `:8080`.

### 2. Iniciar el Frontend (Interfaz de Usuario)
En la terminal que tienes en la **raíz del proyecto**, ejecuta:
```bash
npm run dev
```
La consola te mostrará una URL local, por lo general `http://localhost:5173`. 
Mantén presionada la tecla `Ctrl` y haz clic en ese enlace (o cópialo y pégalo en tu navegador).

¡Listo! Ya deberías ver el dashboard interactivo de la bomba de insulina.

---


## 💡 Uso del Simulador

Al ingresar por primera vez, verás un **Tutorial Interactivo** guiado que te explicará todas las métricas.
A modo de resumen:

1. **Parámetros PID:** Podrás ajustar las ganancias en tiempo real. Prueba el botón de **Valores Óptimos** para ver cómo se estabiliza.
2. **Glucosa Inicial y Setpoint:** Modifica desde dónde arranca la simulación y cuál es el objetivo a alcanzar. Luego haz clic en **Reset ↺** arriba a la derecha.
3. **Reproducción:** Usa los botones superiores de **Play ▶** y **Pausa ⏸** para arrancar el tiempo. También puedes acelerar el tiempo simulado (x1 a x10).
4. **Perturbaciones:** En el panel derecho puedes agregar "Comidas" o "Fallos Técnicos" para ver cómo el PID intenta contrarrestarlos.

## ⚠️ Problemas que se pueden tener y como solucionarlos

- **Cartel rojo "Desconectado del backend Go"**: Significa que el servidor de Go no está corriendo o se cerró. Asegúrate de tener la terminal del backend abierta y corriendo el comando `go run .`.
- **"Port 8080 is already in use"**: Algún otro programa en tu computadora está usando el puerto 8080. Cierra otros programas de desarrollo o reinicia la computadora si no encuentras cuál es.
- **"Command not found: npm" o "Command not found: go"**: Significa que Node.js o Go no se instalaron correctamente, o necesitas reiniciar tu terminal/computadora para que se apliquen los cambios del PATH.
