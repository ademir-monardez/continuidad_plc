using NModbus;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;

 class Program
{
    private const string SupabaseUrl = "https://nursugqypwjcxgooltgo.supabase.co";
    //private const string SupabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51cnN1Z3F5cHdqY3hnb29sdGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMzkwNjEsImV4cCI6MjA5NzcxNTA2MX0.IkScFVVPhSAC_Q1NnP5q6DUNC9CASRj5Omcyy3ZnAf4";
    private const string SupabaseKey = "sb_publishable_6tSi5_on0TrNxfzn8Iue1Q_mdSSOqGo" ;
    private static async Task Main()
    {
        string ip = "192.168.1.214";
        int port = 502;
        byte slaveId = 1;

        try
        {
            int numberOfPoints = 3;

            using var tcpClient = new TcpClient();

            Console.WriteLine($"Conectando a {ip}:{port}...");

            await tcpClient.ConnectAsync(ip, port);

            var factory = new ModbusFactory();

            using var master = factory.CreateMaster(tcpClient);

            while (true)
            {
                Console.WriteLine("Elige una opcion:");
                Console.WriteLine("1 - Leer 3 coils una vez");
                Console.WriteLine("2 - Leer 3 coils cada 5 segundos");
                Console.WriteLine("3 - Leer solo cuando haya cambios");
                Console.Write("Opcion: ");

                string? opcion = Console.ReadLine();

                if (opcion != "1" && opcion != "2" && opcion != "3")
                {
                    Console.WriteLine("\u26A0 Eliga una opcion valida entre la 1 y la 3 \u26A0");
                    continue;
                }

                if (opcion == "1")
                {
                    bool[] coils = await master.ReadCoilsAsync(
                        slaveId,
                        startAddress: 0,
                        numberOfPoints: (ushort)numberOfPoints);

                    Console.WriteLine("Resultado:");

                    for (int i = 0; i < coils.Length; i++)
                    {
                        Console.WriteLine($"Coil {i}: {coils[i]}");
                    }

                    break;
                }
                else if (opcion == "2")
                {
                    int segundos = 0;

                    while (true)
                    {
                        bool[] coils = await master.ReadCoilsAsync(
                            slaveId,
                            startAddress: 0,
                            numberOfPoints: (ushort)numberOfPoints);

                        Console.WriteLine($"Resultado {segundos} segundos:");

                        for (int i = 0; i < coils.Length; i++)
                        {
                            Console.WriteLine($"Coil {i}: {coils[i]}");
                        }

                        await Task.Delay(5000);
                        segundos += 5;
                    }
                }
                else if (opcion == "3")
                {
                    bool[] coilsAnteriores = await master.ReadCoilsAsync(
                        slaveId,
                        startAddress: 0,
                        numberOfPoints: (ushort)numberOfPoints);

                    Console.WriteLine("Lectura inicial:");

                    for (int i = 0; i < coilsAnteriores.Length; i++)
                    {
                        Console.WriteLine($"Coil {i}: {coilsAnteriores[i]}");

                        await GuardarCambioEnSupabaseAsync(
                            coilId: i,
                            estadoPrevio: coilsAnteriores[i],
                            estadoActual: coilsAnteriores[i],
                            evento: "Estado inicial");
                    }

                    while (true)
                    {
                        bool[] coilsActuales = await master.ReadCoilsAsync(
                            slaveId,
                            startAddress: 0,
                            numberOfPoints: (ushort)numberOfPoints);

                        bool hayCambio = false;

                        for (int i = 0; i < coilsActuales.Length; i++)
                        {
                            if (coilsActuales[i] != coilsAnteriores[i])
                            {
                                hayCambio = true;
                                break;
                            }
                        }

                        if (hayCambio)
                        {
                            DateTime fechaCambio = DateTime.Now;

                            Console.WriteLine($"Cambio detectado: {fechaCambio:dd-MM-yyyy HH:mm:ss}");

                            for (int i = 0; i < coilsActuales.Length; i++)
                            {
                                Console.WriteLine($"Coil {i}: {coilsActuales[i]}");

                                if (coilsActuales[i] != coilsAnteriores[i])
                                {
                                    await GuardarCambioEnSupabaseAsync(
                                        coilId: i,
                                        estadoPrevio: coilsAnteriores[i],
                                        estadoActual: coilsActuales[i]);
                                }
                            }

                            coilsAnteriores = coilsActuales;
                        }

                        await Task.Delay(100);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error: {ex.Message}");
        }
    }

    private static async Task GuardarCambioEnSupabaseAsync(int coilId, bool estadoPrevio, bool estadoActual, string? evento = null)
    {
        try
        {
            using var httpClient = new HttpClient();

            var datos = new
            {
                coil_id = coilId,
                coil_nombre = $"Coil {coilId}",
                estado_actual = estadoActual,
                estado_previo = estadoPrevio,
                evento = evento ?? (estadoActual ? "Activada" : "Desactivada")
            };

            string json = JsonSerializer.Serialize(datos);

            using var request = new HttpRequestMessage(
                HttpMethod.Post,
                $"{SupabaseUrl}/rest/v1/deteccion_coils");

            request.Headers.Add("apikey", SupabaseKey);
            request.Headers.Add("Prefer", "return=minimal");
            request.Content = new StringContent(json, Encoding.UTF8, "application/json");

            using HttpResponseMessage response = await httpClient.SendAsync(request);

            if (response.IsSuccessStatusCode)
            {
                Console.WriteLine($"Cambio guardado en Supabase para Coil {coilId}");
            }
            else
            {
                string error = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"No se pudo guardar en Supabase: {response.StatusCode} - {error}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error al guardar en Supabase: {ex.Message}");
        }
    }
}
