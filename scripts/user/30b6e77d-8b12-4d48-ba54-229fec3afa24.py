#!/usr/bin/env python3
"""
Script de exemplo: Status do Sistema

Coleta informaÃ§Ãµes sobre uso de CPU, memÃ³ria e disco do sistema.
Ideal para monitoramento em Raspberry Pi.

Requer: psutil
Instalar com: pip install psutil
"""

import json
import platform
import sys
from datetime import datetime

try:
    import psutil
except ImportError:
    print("âŒ Erro: biblioteca 'psutil' nÃ£o encontrada")
    print("Instale com: pip install psutil")
    sys.exit(1)


def get_system_status():
    """Coleta informaÃ§Ãµes do sistema"""
    
    # CPU
    cpu_percent = psutil.cpu_percent(interval=1)
    cpu_count = psutil.cpu_count()
    
    # MemÃ³ria
    memory = psutil.virtual_memory()
    memory_total = memory.total / (1024 ** 3)  # GB
    memory_used = memory.used / (1024 ** 3)
    memory_percent = memory.percent
    
    # Disco
    disk = psutil.disk_usage('/')
    disk_total = disk.total / (1024 ** 3)
    disk_used = disk.used / (1024 ** 3)
    disk_percent = disk.percent
    
    # Temperatura (Raspberry Pi)
    temp = None
    try:
        temp_sensors = psutil.sensors_temperatures()
        if 'cpu_thermal' in temp_sensors:
            temp = temp_sensors['cpu_thermal'][0].current
    except:
        pass
    
    return {
        'timestamp': datetime.now().isoformat(),
        'hostname': platform.node(),
        'system': platform.system(),
        'cpu': {
            'percent': cpu_percent,
            'cores': cpu_count,
        },
        'memory': {
            'total_gb': round(memory_total, 2),
            'used_gb': round(memory_used, 2),
            'percent': memory_percent,
        },
        'disk': {
            'total_gb': round(disk_total, 2),
            'used_gb': round(disk_used, 2),
            'percent': disk_percent,
        },
        'temperature_celsius': temp,
    }


def main():
    print("í¶¥ï¸  Coletando status do sistema...\n")
    
    try:
        status = get_system_status()
        
        # Exibir no console
        print(f"í¿·ï¸  Hostname: {status['hostname']}")
        print(f"í²» Sistema: {status['system']}")
        print(f"\ní³Š CPU: {status['cpu']['percent']}% ({status['cpu']['cores']} cores)")
        print(f"í·  MemÃ³ria: {status['memory']['used_gb']} GB / {status['memory']['total_gb']} GB ({status['memory']['percent']}%)")
        print(f"í²¾ Disco: {status['disk']['used_gb']} GB / {status['disk']['total_gb']} GB ({status['disk']['percent']}%)")
        
        if status['temperature_celsius']:
            print(f"í¼¡ï¸  Temperatura: {status['temperature_celsius']}Â°C")
        
        # Alertas
        print("\nâš ï¸  Alertas:")
        alerts = []
        if status['cpu']['percent'] > 80:
            alerts.append(f"  - CPU alta: {status['cpu']['percent']}%")
        if status['memory']['percent'] > 80:
            alerts.append(f"  - MemÃ³ria alta: {status['memory']['percent']}%")
        if status['disk']['percent'] > 90:
            alerts.append(f"  - Disco cheio: {status['disk']['percent']}%")
        if status['temperature_celsius'] and status['temperature_celsius'] > 70:
            alerts.append(f"  - Temperatura alta: {status['temperature_celsius']}Â°C")
        
        if alerts:
            for alert in alerts:
                print(alert)
        else:
            print("  Nenhum alerta. Sistema OK! âœ…")
        
        # JSON para parsing
        print(f"\ní³‹ JSON:")
        print(json.dumps(status, indent=2))
        
        sys.exit(0)
        
    except Exception as e:
        print(f"âŒ Erro ao coletar status: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
