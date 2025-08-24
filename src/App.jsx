import { useEffect, useState } from "react";
import mqtt from "mqtt";

const MQTT_BROKER = import.meta.env.VITE_MQTT_BROKER;
const TOPIC = import.meta.env.VITE_MQTT_TOPIC;
const CONFIG_TOPIC =
  import.meta.env.VITE_MQTT_CONFIG_TOPIC || "sensors/riego_esp32_01/config";

function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [client, setClient] = useState(null);

  const [data, setData] = useState({
    humedad: null,
    temperatura: null,
    umbral: null,
  });
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
        mqttClient.subscribe(TOPIC, (err) => {
          if (!err) console.log(`Suscrito al tópico: ${TOPIC}`);
        });
      });

      mqttClient.on("message", (topic, message) => {
        try {
          const payload = JSON.parse(message.toString());
          setData(payload);
        } catch (err) {
          console.error("Error al parsear mensaje:", err);
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
    if (client && (newUmbral || newDuracion)) {
      const payload = {};
      if (newUmbral) payload.umbral = parseFloat(newUmbral);
      if (newDuracion) payload.duracion = parseFloat(newDuracion) * 60000; // minutos a ms
      client.publish(CONFIG_TOPIC, JSON.stringify(payload));
      console.log("Nueva configuración enviada:", payload);
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

  return (
    <div
      style={{ fontFamily: "sans-serif", textAlign: "center", marginTop: 50 }}
    >
      <h1>Sensor ESP32 Dashboard</h1>
      <h2>
        Humedad:{" "}
        {data.humedad !== null ? `${data.humedad.toFixed(1)} %` : "..."}
      </h2>
      <h2>
        Temperatura:{" "}
        {data.temperatura !== null
          ? `${data.temperatura.toFixed(1)} °C`
          : "..."}
      </h2>
      <h2>
        Umbral actual:{" "}
        {data.umbral !== null ? `${data.umbral.toFixed(1)} %` : "..."}
      </h2>
      <h2>
        Tiempo de riego actual:{" "}
        {data.duracion !== null
          ? `${(data.duracion / 60000).toFixed(1)} min`
          : "..."}
      </h2>

      <div style={{ marginTop: 30 }}>
        <input
          type="number"
          value={newUmbral}
          placeholder="Nuevo umbral (%)"
          onChange={(e) => setNewUmbral(e.target.value)}
          style={{ marginRight: 10 }}
        />
        <input
          type="number"
          value={newDuracion}
          placeholder="Duración riego (min)"
          onChange={(e) => setNewDuracion(e.target.value)}
          style={{ marginRight: 10 }}
        />
        <button onClick={handleConfigChange}>Cambiar Configuración</button>
      </div>
    </div>
  );
}

export default App;
