import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function generateRoomId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let roomId = "";
  for (let i = 0; i < 8; i++) {
    roomId += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return roomId;
}

function Home() {
  const [inputRoomId, setInputRoomId] = useState("");
  const navigate = useNavigate();

  const handleCreateRoom = () => {
    const newRoomId = generateRoomId();
    navigate(`/room/${newRoomId}`);
  };

  const handleJoinRoom = () => {
    if (inputRoomId.trim() !== "") {
      navigate(`/room/${inputRoomId.trim()}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-100">
      <h1 className="text-4xl font-bold mb-10">Collaborative Whiteboard</h1>
      
      <button 
        onClick={handleCreateRoom}
        className="bg-blue-600 text-white px-6 py-3 rounded mb-6 text-lg hover:bg-blue-700"
      >
        Create Room
      </button>

      <div className="flex flex-col items-center gap-4">
        <input
          type="text"
          value={inputRoomId}
          onChange={(e) => setInputRoomId(e.target.value)}
          placeholder="Enter Room ID"
          className="px-4 py-2 rounded border border-gray-400 w-64"
        />
        <button 
          onClick={handleJoinRoom}
          className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
        >
          Join Room
        </button>
      </div>
    </div>
  );
}

export default Home;
