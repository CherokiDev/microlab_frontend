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
    console.log("⚙️ Config enviada");
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
      <h1>Dashboard de sensores de riego</h1>

      <div
        className="sensor-list"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "18px",
          justifyContent: "center",
          marginTop: "1rem",
          marginBottom: "1rem",
        }}
      >
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
              style={{
                padding: "12px 18px",
                borderWidth: "2px",
                borderStyle: "solid",
                borderColor: selectedSensor === id ? "#1976d2" : "#007bff",
                borderRadius: "12px",
                cursor: "pointer",
                fontWeight: "bold",
                minWidth: "120px",
                background: selectedSensor === id ? "#e3f2fd" : "#fff",
                color: "#007bff",
                transition: "background 0.2s, color 0.2s, border-color 0.2s",
              }}
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
  // Los eventos llegan como array de strings JSON, los parseamos aquí
  const eventos = (data?.eventos || []).map((ev) => {
    try {
      return typeof ev === "string" ? JSON.parse(ev) : ev;
    } catch {
      return { evento: ev, fecha: null };
    }
  });
  const colorEstado = data.nivel_agua ? "#388e3c" : "#d32f2f";

  const renderEvento = (evObj, idx) => {
    if (!evObj || typeof evObj !== "object") return null;
    const { evento, fecha } = evObj;

    let mensaje = null;
    switch (evento) {
      case "ntp_error":
        mensaje = "⚠️ Error NTP: hora no sincronizada";
        break;
      case "sleep_nocturno":
        mensaje = "💤 Modo reposo nocturno";
        break;
      case "pump_on":
        mensaje = "🚰 Bomba encendida";
        break;
      case "pump_off_no_water":
        mensaje = "🚫 Bomba apagada por falta de agua";
        break;
      case "pump_off_done":
        mensaje = "⏹️ Bomba apagada (duración completada)";
        break;
      case "init_ok":
        mensaje = "✅ Inicialización correcta";
        break;
      case "pump_blocked_no_water":
        mensaje = "🛑 Bomba bloqueada por falta de agua";
        break;
      default:
        mensaje = evento;
    }

    return (
      <div key={idx} className="alert-evento">
        <span>{mensaje}</span>
        {fecha && (
          <>
            <br />
            <span
              style={{ marginLeft: "20px", color: "#888", fontSize: "0.9em" }}
            >
              {new Date(fecha).toLocaleString()}
            </span>
          </>
        )}
        <hr
          style={{
            margin: "5px 0",
            border: "none",
            borderTop: "1px solid #ccc",
          }}
        />
      </div>
    );
  };

  // Verifica si el evento sleep_nocturno está activo
  const enReposoNocturno = eventos.some((ev) => ev.evento === "sleep_nocturno");

  return (
    <div className="card">
      <h2 style={{ color: "#1976d2" }}>Sensor: {id}</h2>

      {eventos.length > 0 && <div>{eventos.map(renderEvento)}</div>}

      {enReposoNocturno ? (
        <div style={{ marginTop: 20, color: "#888", fontStyle: "italic" }}>
          El sensor está en <b>modo reposo nocturno</b>. Los valores no se
          actualizan durante este periodo.
        </div>
      ) : (
        <>
          <p style={{ color: colorEstado, fontWeight: "bold" }}>
            {data.nivel_agua ? "💧 Depósito OK" : "🚫 Sin agua"}
          </p>
          <p>🌡️ Temp: {data.temperatura?.toFixed(1) ?? "--"} °C</p>
          <p>💦 Humedad: {data.humedad?.toFixed(1) ?? "--"} %</p>
          <p>🎚️ Umbral: {data.umbral?.toFixed(1) ?? "--"} %</p>
          <p>
            ⏱️ Duración:{" "}
            {data.duracion ? (data.duracion / 60000).toFixed(1) : "--"} min
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
        </>
      )}
    </div>
  );
}
