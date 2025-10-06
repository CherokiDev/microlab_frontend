import { useEffect, useState, useRef } from "react";
import mqtt from "mqtt";

const MQTT_BROKER = import.meta.env.VITE_MQTT_BROKER;

// Estructura de tópicos consistente con el firmware
const BASE_TOPIC = "sensors/";
const CONFIG_SUFFIX = "/config";
const EVENTS_SUFFIX = "/events";

export default function App() {
  const [auth, setAuth] = useState({ username: "", password: "" });
  const [isConnected, setIsConnected] = useState(false);
  const [client, setClient] = useState(null);

  const [sensors, setSensors] = useState({});
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [newConfig, setNewConfig] = useState({ umbral: "", duracion: "" });

  const reconnectTimeout = useRef(null);

  // ===== Conexión MQTT =====
  useEffect(() => {
    if (!isConnected || !auth.username || !auth.password) return;

    console.log("🔌 Conectando al broker");
    const mqttClient = mqtt.connect(MQTT_BROKER, {
      username: auth.username,
      password: auth.password,
      reconnectPeriod: 5000,
      keepalive: 30,
      clean: true,
      connectTimeout: 4000,
      rejectUnauthorized: false,
    });

    mqttClient.on("connect", () => {
      console.log("✅ Conectado a MQTT");
      mqttClient.subscribe(`${BASE_TOPIC}#`);
      setClient(mqttClient);
      setIsConnected(true);
    });

    mqttClient.on("reconnect", () =>
      console.log("♻️ Reintentando conexión...")
    );
    mqttClient.on("error", (err) =>
      console.error("❌ Error MQTT:", err.message)
    );

    mqttClient.on("message", (topic, message) => {
      try {
        const payload = JSON.parse(message.toString());
        const match = topic.match(/^sensors\/([^/]+)(?:\/([^/]+))?/);
        if (!match) return;

        const [, deviceId, subTopic] = match;
        setSensors((prev) => {
          const prevSensor = prev[deviceId] || {};

          // Manejo de eventos como array
          if (subTopic === "events") {
            return {
              ...prev,
              [deviceId]: {
                ...prevSensor,
                eventos: Array.isArray(payload) ? payload : [payload],
              },
            };
          } else if (subTopic === "config") {
            return { ...prev, [deviceId]: { ...prevSensor, ...payload } };
          } else {
            // Datos generales (estado, humedad, etc.)
            return { ...prev, [deviceId]: { ...prevSensor, ...payload } };
          }
        });
      } catch (err) {
        console.error("Error procesando mensaje:", err);
      }
    });

    mqttClient.on("close", () => {
      console.warn("⚠️ Conexión MQTT cerrada.");
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = setTimeout(() => {
        setIsConnected(false);
        setClient(null);
      }, 5000);
    });

    return () => {
      mqttClient.end(true);
      clearTimeout(reconnectTimeout.current);
    };
  }, [isConnected, auth]);

  // ===== Enviar nueva configuración =====
  const handleConfigChange = () => {
    if (!client || !selectedSensor) return;
    const payload = {};
    if (newConfig.umbral) payload.umbral = parseFloat(newConfig.umbral);
    if (newConfig.duracion)
      payload.duracion = parseFloat(newConfig.duracion) * 60000;

    const topic = `${BASE_TOPIC}${selectedSensor}${CONFIG_SUFFIX}`;
    client.publish(topic, JSON.stringify(payload));
    console.log("⚙️ Config enviada:");
    setNewConfig({ umbral: "", duracion: "" });
  };

  // ===== Pantalla login =====
  if (!isConnected) {
    return (
      <div className="center">
        <h1>Conectar al broker MQTT</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setIsConnected(true);
          }}
        >
          <input
            type="text"
            placeholder="Usuario"
            value={auth.username}
            onChange={(e) => setAuth({ ...auth, username: e.target.value })}
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={auth.password}
            onChange={(e) => setAuth({ ...auth, password: e.target.value })}
          />
          <button type="submit">Conectar</button>
        </form>
      </div>
    );
  }

  const sensorIds = Object.keys(sensors);

  return (
    <div className="container">
      <h1>🌿 Dashboard de Riego ESP32</h1>

      <div className="sensor-list">
        {sensorIds.length === 0 ? (
          <p style={{ color: "#888" }}>Esperando sensores...</p>
        ) : (
          sensorIds.map((id) => (
            <button
              key={id}
              onClick={() => setSelectedSensor(id)}
              className={`sensor-btn${
                selectedSensor === id ? " selected" : ""
              }`}
            >
              {id}
            </button>
          ))
        )}
      </div>

      {selectedSensor && sensors[selectedSensor] && (
        <SensorCard
          id={selectedSensor}
          data={sensors[selectedSensor]}
          onConfigChange={handleConfigChange}
          newConfig={newConfig}
          setNewConfig={setNewConfig}
        />
      )}
    </div>
  );
}

// ===== Componente para mostrar un sensor =====
function SensorCard({ id, data, onConfigChange, newConfig, setNewConfig }) {
  const eventos = data?.eventos || [];
  const colorEstado = data.nivel_agua ? "#388e3c" : "#d32f2f";

  const renderEvento = (ev, idx) => {
    switch (ev) {
      case "ntp_error":
        return (
          <div key={idx} className="alert-error">
            ⚠️ Error NTP: hora no sincronizada
          </div>
        );
      case "sleep_nocturno":
        return (
          <div key={idx} className="alert-sleep">
            💤 Modo reposo nocturno
          </div>
        );
      case "pump_on":
        return (
          <div key={idx} className="alert-pump-on">
            🚰 Bomba encendida
          </div>
        );
      case "pump_off_no_water":
        return (
          <div key={idx} className="alert-error">
            🚫 Bomba apagada por falta de agua
          </div>
        );
      case "pump_off_done":
        return (
          <div key={idx} className="alert-sleep">
            ⏹️ Bomba apagada (duración completada)
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="card">
      <h2 style={{ color: "#1976d2" }}>Sensor: {id}</h2>

      {eventos.length > 0 && <div>{eventos.map(renderEvento)}</div>}

      <p style={{ color: colorEstado, fontWeight: "bold" }}>
        {data.nivel_agua ? "💧 Depósito OK" : "🚫 Sin agua"}
      </p>
      <p>🌡️ Temp: {data.temperatura?.toFixed(1) ?? "--"} °C</p>
      <p>💦 Humedad: {data.humedad?.toFixed(1) ?? "--"} %</p>
      <p>🎚️ Umbral: {data.umbral?.toFixed(1) ?? "--"} %</p>
      <p>
        ⏱️ Duración: {data.duracion ? (data.duracion / 60000).toFixed(1) : "--"}{" "}
        min
      </p>

      <div style={{ marginTop: 20 }}>
        <input
          type="number"
          placeholder="Nuevo umbral (%)"
          value={newConfig.umbral}
          onChange={(e) =>
            setNewConfig({ ...newConfig, umbral: e.target.value })
          }
          className="input-small"
        />
        <input
          type="number"
          placeholder="Duración (min)"
          value={newConfig.duracion}
          onChange={(e) =>
            setNewConfig({ ...newConfig, duracion: e.target.value })
          }
          className="input-small"
        />
        <button onClick={onConfigChange} className="button-small">
          Enviar
        </button>
      </div>
    </div>
  );
}
