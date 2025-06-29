import React, { useRef, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { jsPDF } from "jspdf";
import { useParams } from 'react-router-dom';

const socket = io("http://localhost:5000");

function Whiteboard() {
  const { roomId } = useParams();
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [userColor, setUserColorState] = useState("black");
  const [tool, setToolState] = useState("pen");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [eraserWidth, setEraserWidth] = useState(10);

  const userColorRef = useRef("black");
  const toolRef = useRef("pen");
  const userIdRef = useRef(null);
  const allUserHistories = useRef({}); // { userId: Stroke[][] }
  const currentStroke = useRef([]);

  // Setters for ref + state
  const setUserColor = (color) => {
    setUserColorState(color);
    userColorRef.current = color;
  };

  const setTool = (toolName) => {
    setToolState(toolName);
    toolRef.current = toolName;
  };

  const redrawCanvas = () => {
    const ctx = ctxRef.current;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    Object.values(allUserHistories.current).forEach(history => {
      history.forEach(stroke => {
        stroke.forEach(({ x0, y0, x1, y1, color, width }) => {
          ctx.strokeStyle = color;
          ctx.lineWidth = width;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        });
      });
    });
  };

  useEffect(() => {
    if (roomId) socket.emit("join_room", roomId);

    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctxRef.current = ctx;

    socket.on("connect", () => {
      userIdRef.current = socket.id;
    });

    socket.on("assign_color", (color) => {
      setUserColor(color);
    });

    socket.on("drawing", ({ x0, y0, x1, y1, color, width, userId }) => {
      if (!allUserHistories.current[userId]) allUserHistories.current[userId] = [];
      const strokeLine = { x0, y0, x1, y1, color, width };

      const lastStroke = allUserHistories.current[userId].at(-1);
      if (!lastStroke) {
        allUserHistories.current[userId].push([strokeLine]);
      } else {
        lastStroke.push(strokeLine);
      }

      const ctx = ctxRef.current;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    });

   socket.on("user_undo", ({ userId }) => {
  const history = allUserHistories.current[userId];
  if (history && history.length > 0) {
    history.pop();
    redrawCanvas();
  }
});

socket.on("user_redo", ({ userId, stroke }) => {
  if (!allUserHistories.current[userId]) {
    allUserHistories.current[userId] = [];
  }
  allUserHistories.current[userId].push(stroke);
  redrawCanvas();
});

    return () => {
      socket.disconnect();
    };
  }, [roomId]);

  const prev = useRef({ x: 0, y: 0 });

  const startDrawing = ({ nativeEvent }) => {
    const { offsetX, offsetY } = nativeEvent;
    if (toolRef.current === "pen" || toolRef.current === "eraser") {
      setIsDrawing(true);
      prev.current = { x: offsetX, y: offsetY };
      currentStroke.current = [];
    }
  };

  const draw = ({ nativeEvent }) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = nativeEvent;
    const color = toolRef.current === "pen" ? userColorRef.current : "#ffffff";
    const width = toolRef.current === "pen" ? strokeWidth : eraserWidth;

    const line = { x0: prev.current.x, y0: prev.current.y, x1: offsetX, y1: offsetY, color, width };
    currentStroke.current.push(line);

    const ctx = ctxRef.current;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(prev.current.x, prev.current.y);
    ctx.lineTo(offsetX, offsetY);
    ctx.stroke();

    socket.emit("drawing", { ...line, userId: userIdRef.current });
    prev.current = { x: offsetX, y: offsetY };
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const uid = userIdRef.current;
    if (!allUserHistories.current[uid]) allUserHistories.current[uid] = [];

    if (currentStroke.current.length > 0) {
      allUserHistories.current[uid].push(currentStroke.current);
      currentStroke.current = [];
    }
  };

  const undo = () => {
    socket.emit("undo", { roomId });
  };

  const redo = () => {
    socket.emit("redo", { roomId });
  };

  const exportAsPNG = () => {
    const link = document.createElement('a');
    link.download = 'whiteboard.png';
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  const exportAsPDF = () => {
    const imgData = canvasRef.current.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [canvasRef.current.width, canvasRef.current.height],
    });
    pdf.addImage(imgData, 'PNG', 0, 0);
    pdf.save("whiteboard.pdf");
  };

  return (
    <div className="w-screen h-screen bg-white flex flex-col items-center justify-center relative">
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
        className="border-2 border-gray-400 rounded-lg shadow-lg"
      />
      <div className="absolute top-4 left-4 bg-white px-4 py-2 rounded shadow font-bold text-gray-700">
        Collaborative Whiteboard
      </div>
      <div className="absolute top-20 left-4 bg-white px-3 py-1 rounded shadow border text-sm font-mono">
        Room ID: {roomId}
      </div>
      <div className="absolute top-4 right-4 px-3 py-1 rounded-full shadow text-white"
        style={{ backgroundColor: userColor }}>
        Your Color
      </div>

      <div className="absolute bottom-4 left-4 flex gap-2">
        {["black", "red", "blue", "green", "orange", "purple", "brown", "gray"].map((color) => (
          <button key={color}
            onClick={() => setUserColor(color)}
            className={`w-8 h-8 rounded-full border-2 ${userColor === color ? "ring-2 ring-black" : ""}`}
            style={{ backgroundColor: color }} />
        ))}
      </div>

      <div className="absolute bottom-4 right-4 flex gap-2">
        <button onClick={() => setTool("pen")} className="px-3 py-1 rounded bg-blue-500 text-white">Pen</button>
        <button onClick={() => setTool("eraser")} className="px-3 py-1 rounded bg-red-500 text-white">Eraser</button>
      </div>

      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white p-2 rounded shadow flex items-center gap-4">
        <div className="flex flex-col items-center">
          <label className="text-xs font-medium">Stroke Width</label>
          <input type="range" min="1" max="20" value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))} />
        </div>
        <div className="flex flex-col items-center">
          <label className="text-xs font-medium">Eraser Width</label>
          <input type="range" min="5" max="50" value={eraserWidth} onChange={(e) => setEraserWidth(Number(e.target.value))} />
        </div>
      </div>

      <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-white px-3 py-2 rounded shadow flex gap-2">
        <button onClick={undo} className="px-2 py-1 bg-yellow-500 text-white rounded">Undo</button>
        <button onClick={redo} className="px-2 py-1 bg-green-500 text-white rounded">Redo</button>
      </div>

      <div className="absolute bottom-40 left-1/2 transform -translate-x-1/2 bg-white px-3 py-2 rounded shadow flex gap-2">
        <button onClick={exportAsPNG} className="px-2 py-1 bg-indigo-500 text-white rounded">Export PNG</button>
        <button onClick={exportAsPDF} className="px-2 py-1 bg-purple-600 text-white rounded">Export PDF</button>
      </div>
    </div>
  );
}

export default Whiteboard;
