import React from "react";
import { Routes, Route } from "react-router-dom";
import Whiteboard from "./components/Whiteboard";
import Home from "./components/Home";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/room/:roomId" element={<Whiteboard />} />
    </Routes>
  );
}

export default App;
