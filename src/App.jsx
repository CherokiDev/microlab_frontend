import { useEffect, useState } from "react";
import mqtt from "mqtt";

const MQTT_BROKER = import.meta.env.VITE_MQTT_BROKER;
const CONFIG_TOPIC_PREFIX = "sensors/riego_esp32_";
const CONFIG_TOPIC_SUFFIX = "/config";

function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [client, setClient] = useState(null);

  // Estado para todos los sensores
  const [sensors, setSensors] = useState({}); // { xxx: { humedad, temperatura, umbral, duracion } }
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [newUmbral, setNewUmbral] = useState("");
  const [newDuracion, setNewDuracion] = useState("");

  useEffect(() => {
    if (isConnected) {
      const mqttClient = mqtt.connect(MQTT_BROKER, {
        username,
        password,
        rejectUnauthorized: false,
      });
      setClient(mqttClient);

      mqttClient.on("connect", () => {
        mqttClient.subscribe("sensors/#", (err) => {
          if (!err) console.log("Suscrito a todos los sensores");
        });
      });

      mqttClient.on("message", (topic, message) => {
        // topic: sensors/riego_esp32_xxx
        const match = topic.match(/sensors\/riego_esp32_(\w+)/);
        if (match) {
          const sensorId = match[1];
          try {
            const payload = JSON.parse(message.toString());
            setSensors((prev) => ({
              ...prev,
              [sensorId]: payload,
            }));
          } catch (err) {
            console.error("Error al parsear mensaje:", err);
          }
        }
      });

      return () => mqttClient.end();
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

  const handleConfigChange = () => {
    if (client && selectedSensor && (newUmbral || newDuracion)) {
      const payload = {};
      if (newUmbral) payload.umbral = parseFloat(newUmbral);
      if (newDuracion) payload.duracion = parseFloat(newDuracion) * 60000;
      const configTopic = `${CONFIG_TOPIC_PREFIX}${selectedSensor}${CONFIG_TOPIC_SUFFIX}`;
      client.publish(configTopic, JSON.stringify(payload));
      console.log("Nueva configuración enviada a", configTopic, payload);
      setNewUmbral("");
      setNewDuracion("");
    }
  };

  if (!isConnected) {
    return (
      <div
        style={{ fontFamily: "sans-serif", textAlign: "center", marginTop: 50 }}
      >
        <h1>Conexión al Broker MQTT</h1>
        <form onSubmit={handleLogin} style={{ marginTop: 20 }}>
          <div>
            <label>
              Usuario:
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ marginLeft: 10 }}
              />
            </label>
          </div>
          <div style={{ marginTop: 10 }}>
            <label>
              Contraseña:
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ marginLeft: 10 }}
              />
            </label>
          </div>
          <button type="submit" style={{ marginTop: 20 }}>
            Conectar
          </button>
        </form>
      </div>
    );
  }

  // Lista de sensores detectados
  const sensorIds = Object.keys(sensors);

  return (
    <div id="root">
      <h1>Dashboard Sensores ESP32</h1>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 20,
          marginBottom: 30,
          flexWrap: "wrap",
        }}
      >
        {sensorIds.length === 0 ? (
          <span style={{ color: "#888", fontSize: 18 }}>
            No hay sensores conectados aún.
          </span>
        ) : (
          sensorIds.map((id) => (
            <button
              key={id}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                border:
                  selectedSensor === id
                    ? "2px solid #007bff"
                    : "1px solid #007bff",
                background: selectedSensor === id ? "#e3f2fd" : "#fff",
                color: selectedSensor === id ? "#007bff" : "#213547",
                fontWeight: "bold",
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                minWidth: 120,
              }}
              onClick={() => setSelectedSensor(id)}
            >
              Sensor <span style={{ color: "#0056b3" }}>{id}</span>
            </button>
          ))
        )}
      </div>

      {selectedSensor && sensors[selectedSensor] && (
        <div className="card">
          <h2 style={{ marginBottom: 20, color: "#007bff" }}>
            Sensor <span style={{ color: "#0056b3" }}>{selectedSensor}</span>
          </h2>
          {/* NIVEL AGUA */}
          <div style={{ fontSize: 20, marginBottom: 18 }}>
            <strong>Depósito:</strong>{" "}
            {sensors[selectedSensor]?.nivel_agua === false ? (
              <span style={{ color: "#d32f2f", fontWeight: "bold" }}>
                🚫💧 Sin agua en el depósito
              </span>
            ) : sensors[selectedSensor]?.nivel_agua === true ? (
              <span style={{ color: "#388e3c", fontWeight: "bold" }}>
                💧 Depósito OK
              </span>
            ) : (
              <span style={{ color: "#888" }}>...</span>
            )}
          </div>
          <div style={{ fontSize: 20, marginBottom: 10 }}>
            <strong>Humedad:</strong>{" "}
            {sensors[selectedSensor]?.humedad !== undefined &&
            sensors[selectedSensor]?.humedad !== null ? (
              <span style={{ color: "#388e3c" }}>
                {Number(sensors[selectedSensor].humedad).toFixed(1)} %
              </span>
            ) : (
              "..."
            )}
          </div>
          <div style={{ fontSize: 20, marginBottom: 10 }}>
            <strong>Temperatura:</strong>{" "}
            {sensors[selectedSensor]?.temperatura !== undefined &&
            sensors[selectedSensor]?.temperatura !== null ? (
              <span style={{ color: "#f57c00" }}>
                {Number(sensors[selectedSensor].temperatura).toFixed(1)} °C
              </span>
            ) : (
              "..."
            )}
          </div>
          <div style={{ fontSize: 20, marginBottom: 10 }}>
            <strong>Umbral actual:</strong>{" "}
            {sensors[selectedSensor]?.umbral !== undefined &&
            sensors[selectedSensor]?.umbral !== null ? (
              <span style={{ color: "#1976d2" }}>
                {Number(sensors[selectedSensor].umbral).toFixed(1)} %
              </span>
            ) : (
              "..."
            )}
          </div>
          <div style={{ fontSize: 20, marginBottom: 10 }}>
            <strong>Tiempo de riego actual:</strong>{" "}
            {sensors[selectedSensor]?.duracion !== undefined &&
            sensors[selectedSensor]?.duracion !== null ? (
              <span style={{ color: "#6d4c41" }}>
                {(Number(sensors[selectedSensor].duracion) / 60000).toFixed(1)}{" "}
                min
              </span>
            ) : (
              "..."
            )}
          </div>

          <div style={{ marginTop: 30 }}>
            <input
              type="number"
              value={newUmbral}
              placeholder="Nuevo umbral (%)"
              onChange={(e) => setNewUmbral(e.target.value)}
              style={{ marginRight: 10, width: 140 }}
            />
            <input
              type="number"
              value={newDuracion}
              placeholder="Duración riego (min)"
              onChange={(e) => setNewDuracion(e.target.value)}
              style={{ marginRight: 10, width: 140 }}
            />
            <button onClick={handleConfigChange}>Cambiar Configuración</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
