import React, { useEffect, useState } from "react";
import mqtt from "mqtt";

const MQTT_BROKER = import.meta.env.VITE_MQTT_BROKER;
const TOPIC = import.meta.env.VITE_MQTT_TOPIC;

function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [humidity, setHumidity] = useState(null);

  useEffect(() => {
    if (isConnected) {
      const client = mqtt.connect(MQTT_BROKER, {
        username,
        password,
      });

      client.on("connect", () => {
        console.log("Conectado al broker MQTT");
        client.subscribe(TOPIC, (err) => {
          if (!err) {
            console.log(`Suscrito al tópico: ${TOPIC}`);
          } else {
            console.error("Error al suscribirse:", err);
          }
        });
      });

      client.on("message", (topic, message) => {
        if (topic === TOPIC) {
          const data = JSON.parse(message.toString());
          console.log(data);
          setHumidity(data.humidity);
        }
      });

      client.on("error", (err) => {
        console.error("Error en la conexión MQTT:", err);
      });

      // Limpiar conexión al desmontar el componente
      return () => {
        client.end();
      };
    }
  }, [isConnected, username, password]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (username && password) {
      setIsConnected(true);
    } else {
      alert("Por favor, ingresa un usuario y contraseña válidos.");
    }
  };

  if (!isConnected) {
    return (
      <div
        style={{
          fontFamily: "Arial, sans-serif",
          textAlign: "center",
          marginTop: "50px",
        }}
      >
        <h1>Conexión al Broker MQTT</h1>
        <form onSubmit={handleLogin} style={{ marginTop: "20px" }}>
          <div>
            <label>
              Usuario:
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ marginLeft: "10px" }}
              />
            </label>
          </div>
          <div style={{ marginTop: "10px" }}>
            <label>
              Contraseña:
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ marginLeft: "10px" }}
              />
            </label>
          </div>
          <button type="submit" style={{ marginTop: "20px" }}>
            Conectar
          </button>
        </form>
      </div>
    );
  }

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        textAlign: "center",
        marginTop: "50px",
      }}
    >
      <h1>Dashboard de Sensor de Humedad</h1>
      <div style={{ marginTop: "20px" }}>
        <h2>Humedad: {humidity !== null ? `${humidity}%` : "Cargando..."}</h2>
      </div>
    </div>
  );
}

export default App;
