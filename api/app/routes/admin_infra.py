# api/app/routes/admin_infra.py
# Dashboard de infraestrutura AWS para o super_admin.
# Consulta: ECS, RDS, ElastiCache, CloudWatch Logs, Cost Explorer.
# SEGURANÇA: Restrito exclusivamente a super_admin via JWT.

import os
import logging
from datetime import datetime, timedelta, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from app.models.user import UserRole

logger = logging.getLogger(__name__)

admin_infra_bp = Blueprint("admin_infra", __name__)

AWS_REGION = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")
PROJECT_NAME = os.environ.get("PROJECT_NAME", "concurso-platform")

# Cost Explorer é uma API GLOBAL que só responde em us-east-1
# Independente da região dos recursos, o client CE sempre usa us-east-1
CE_REGION = "us-east-1"


def _require_super_admin():
    claims = get_jwt()
    if claims.get("role") != UserRole.SUPER_ADMIN.value:
        return jsonify({"error": "forbidden", "message": "Acesso restrito."}), 403
    return None


def _get_boto_client(service: str, region: str | None = None):
    """Cria client boto3. Cost Explorer sempre usa us-east-1."""
    try:
        import boto3
        return boto3.client(service, region_name=region or AWS_REGION)
    except Exception as e:
        logger.warning(f"boto3 client {service} falhou: {e}")
        return None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _fetch_ecs_services():
    """Lista todos os serviços ECS com status, tasks e health."""
    client = _get_boto_client("ecs")
    if not client:
        return []

    try:
        cluster_name = f"{PROJECT_NAME}-cluster"
        services_resp = client.describe_services(
            cluster=cluster_name,
            services=[
                f"{PROJECT_NAME}-api",
                f"{PROJECT_NAME}-frontend",
            ],
        )
        result = []
        for svc in services_resp.get("services", []):
            result.append({
                "name": svc.get("serviceName", ""),
                "status": svc.get("status", "UNKNOWN"),
                "running_count": svc.get("runningCount", 0),
                "desired_count": svc.get("desiredCount", 0),
                "pending_count": svc.get("pendingCount", 0),
                "task_definition": svc.get("taskDefinition", "").split("/")[-1],
                "created_at": svc["createdAt"].isoformat() if svc.get("createdAt") else None,
                "deployments": [
                    {
                        "status": d.get("status"),
                        "running_count": d.get("runningCount", 0),
                        "desired_count": d.get("desiredCount", 0),
                        "created_at": d["createdAt"].isoformat() if d.get("createdAt") else None,
                    }
                    for d in svc.get("deployments", [])[:2]
                ],
                "load_balancers": [
                    {"target_group_arn": lb.get("targetGroupArn", "").split("/")[-1]}
                    for lb in svc.get("loadBalancers", [])
                ],
            })
        return result
    except Exception as e:
        logger.warning(f"ECS describe_services falhou: {e}")
        return []


def _fetch_ecs_metrics():
    """Busca métricas de CPU/Memória dos serviços ECS via CloudWatch."""
    client = _get_boto_client("cloudwatch")
    if not client:
        return {}

    now = datetime.now(timezone.utc)
    start = now - timedelta(hours=1)

    services = [f"{PROJECT_NAME}-api", f"{PROJECT_NAME}-frontend"]
    metrics = {}

    for svc in services:
        try:
            resp = client.get_metric_data(
                MetricDataQueries=[
                    {
                        "Id": "cpu",
                        "MetricStat": {
                            "Metric": {
                                "Namespace": "AWS/ECS",
                                "MetricName": "CPUUtilization",
                                "Dimensions": [
                                    {"Name": "ClusterName", "Value": f"{PROJECT_NAME}-cluster"},
                                    {"Name": "ServiceName", "Value": svc},
                                ],
                            },
                            "Period": 300,
                            "Stat": "Average",
                        },
                    },
                    {
                        "Id": "mem",
                        "MetricStat": {
                            "Metric": {
                                "Namespace": "AWS/ECS",
                                "MetricName": "MemoryUtilization",
                                "Dimensions": [
                                    {"Name": "ClusterName", "Value": f"{PROJECT_NAME}-cluster"},
                                    {"Name": "ServiceName", "Value": svc},
                                ],
                            },
                            "Period": 300,
                            "Stat": "Average",
                        },
                    },
                ],
                StartTime=start,
                EndTime=now,
            )
            results = {r["Id"]: r["Values"] for r in resp.get("MetricDataResults", [])}
            metrics[svc] = {
                "cpu_percent": round(results["cpu"][0], 1) if results.get("cpu") else None,
                "mem_percent": round(results["mem"][0], 1) if results.get("mem") else None,
                "cpu_history": [round(v, 1) for v in (results.get("cpu") or [])[-12:]],
                "mem_history": [round(v, 1) for v in (results.get("mem") or [])[-12:]],
            }
        except Exception as e:
            logger.warning(f"CloudWatch métricas ECS {svc}: {e}")
            metrics[svc] = {"cpu_percent": None, "mem_percent": None}

    return metrics


def _fetch_rds_status():
    """Retorna status, storage e conexões da instância RDS."""
    client = _get_boto_client("rds")
    if not client:
        return None

    try:
        resp = client.describe_db_instances()
        instances = resp.get("DBInstances", [])
        for inst in instances:
            if PROJECT_NAME in inst.get("DBInstanceIdentifier", ""):
                return {
                    "identifier": inst.get("DBInstanceIdentifier"),
                    "status": inst.get("DBInstanceStatus", "unknown"),
                    "engine": f"{inst.get('Engine')} {inst.get('EngineVersion')}",
                    "instance_class": inst.get("DBInstanceClass"),
                    "storage_gb": inst.get("AllocatedStorage", 0),
                    "multi_az": inst.get("MultiAZ", False),
                    "endpoint": inst.get("Endpoint", {}).get("Address"),
                    "backup_retention": inst.get("BackupRetentionPeriod", 0),
                }
        return None
    except Exception as e:
        logger.warning(f"RDS describe falhou: {e}")
        return None


def _fetch_elasticache_status():
    """Retorna status do Redis ElastiCache."""
    client = _get_boto_client("elasticache")
    if not client:
        return None

    try:
        resp = client.describe_replication_groups()
        for group in resp.get("ReplicationGroups", []):
            if PROJECT_NAME in group.get("ReplicationGroupId", ""):
                node_groups = group.get("NodeGroups", [])
                primary_endpoint = None
                if node_groups:
                    primary_endpoint = node_groups[0].get("PrimaryEndpoint", {}).get("Address")
                return {
                    "id": group.get("ReplicationGroupId"),
                    "status": group.get("Status", "unknown"),
                    "description": group.get("Description"),
                    "num_node_groups": len(node_groups),
                    "primary_endpoint": primary_endpoint,
                    "at_rest_encryption": group.get("AtRestEncryptionEnabled", False),
                    "in_transit_encryption": group.get("TransitEncryptionEnabled", False),
                }
        return None
    except Exception as e:
        logger.warning(f"ElastiCache describe falhou: {e}")
        return None


def _fetch_cloudwatch_logs(log_group: str, search: str | None, limit: int = 50):
    """Filtra eventos do CloudWatch Logs."""
    client = _get_boto_client("logs")
    if not client:
        return []

    try:
        kwargs = {
            "logGroupName": log_group,
            "limit": limit,
            "startTime": int((datetime.now(timezone.utc) - timedelta(hours=6)).timestamp() * 1000),
            "endTime": int(datetime.now(timezone.utc).timestamp() * 1000),
        }
        if search:
            kwargs["filterPattern"] = search

        resp = client.filter_log_events(**kwargs)
        events = resp.get("events", [])
        return [
            {
                "timestamp": datetime.fromtimestamp(
                    e["timestamp"] / 1000, tz=timezone.utc
                ).isoformat(),
                "message": e.get("message", "").strip(),
                "log_stream": e.get("logStreamName", ""),
            }
            for e in events
        ]
    except Exception as e:
        logger.warning(f"CloudWatch filter_log_events falhou ({log_group}): {e}")
        return []


def _fetch_cost_by_service():
    """
    Custo dos últimos 30 dias por serviço AWS via Cost Explorer.
    IMPORTANTE: Cost Explorer é uma API global que SEMPRE usa us-east-1,
    independente da região dos seus recursos.
    """
    # ← FIX: região fixa us-east-1 para Cost Explorer
    client = _get_boto_client("ce", region=CE_REGION)
    if not client:
        return []

    try:
        end = datetime.now(timezone.utc).date()
        start = end - timedelta(days=30)
        resp = client.get_cost_and_usage(
            TimePeriod={"Start": start.isoformat(), "End": end.isoformat()},
            Granularity="DAILY",
            GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}],
            Metrics=["UnblendedCost"],
        )
        totals: dict[str, float] = {}
        for day in resp.get("ResultsByTime", []):
            for group in day.get("Groups", []):
                svc = group["Keys"][0]
                cost = float(group["Metrics"]["UnblendedCost"]["Amount"])
                totals[svc] = totals.get(svc, 0.0) + cost

        items = [
            {"service": k, "total_usd": round(v, 4), "daily_avg_usd": round(v / 30, 4)}
            for k, v in totals.items()
            if v > 0.01
        ]
        items.sort(key=lambda x: x["total_usd"], reverse=True)
        return items
    except Exception as e:
        logger.warning(f"Cost Explorer falhou: {e}")
        return []


def _fetch_security_insights():
    """Insights de segurança: security groups, erros recentes, RDS backup."""
    findings = []

    ec2 = _get_boto_client("ec2")
    if ec2:
        try:
            resp = ec2.describe_security_groups()
            for sg in resp.get("SecurityGroups", []):
                if PROJECT_NAME not in sg.get("GroupName", ""):
                    continue
                for rule in sg.get("IpPermissions", []):
                    for ip_range in rule.get("IpRanges", []):
                        if ip_range.get("CidrIp") == "0.0.0.0/0":
                            from_port = rule.get("FromPort", -1)
                            if from_port not in (80, 443, -1):
                                findings.append({
                                    "severity": "HIGH",
                                    "type": "open_port",
                                    "resource": sg.get("GroupName"),
                                    "description": f"Porta {from_port} aberta para 0.0.0.0/0",
                                })
        except Exception as e:
            logger.warning(f"EC2 security groups check falhou: {e}")

    logs_client = _get_boto_client("logs")
    if logs_client:
        try:
            errors = _fetch_cloudwatch_logs(f"/ecs/{PROJECT_NAME}/api", "[ERROR]", limit=20)
            if errors:
                findings.append({
                    "severity": "MEDIUM",
                    "type": "api_errors",
                    "resource": "ECS API",
                    "description": f"{len(errors)} erros de API nas últimas 6h",
                    "samples": [e["message"][:120] for e in errors[:3]],
                })
        except Exception as e:
            logger.warning(f"Logs error check falhou: {e}")

    rds_info = _fetch_rds_status()
    if rds_info and rds_info.get("backup_retention", 0) == 0:
        findings.append({
            "severity": "HIGH",
            "type": "no_backup",
            "resource": rds_info.get("identifier", "RDS"),
            "description": "Backup automático do RDS está desabilitado",
        })

    if not findings:
        findings.append({
            "severity": "OK",
            "type": "clean",
            "resource": "all",
            "description": "Nenhum problema de segurança detectado",
        })

    return findings


# ── Endpoints ─────────────────────────────────────────────────────────────────

@admin_infra_bp.route("/overview", methods=["GET"])
@jwt_required()
def infra_overview():
    err = _require_super_admin()
    if err:
        return err

    ecs_services = _fetch_ecs_services()
    ecs_metrics = _fetch_ecs_metrics()
    rds = _fetch_rds_status()
    redis = _fetch_elasticache_status()
    costs = _fetch_cost_by_service()
    security = _fetch_security_insights()

    for svc in ecs_services:
        svc["metrics"] = ecs_metrics.get(svc["name"], {})

    total_cost_30d = sum(c["total_usd"] for c in costs)

    return jsonify({
        "region": AWS_REGION,
        "project": PROJECT_NAME,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "ecs": {
            "cluster": f"{PROJECT_NAME}-cluster",
            "services": ecs_services,
        },
        "rds": rds,
        "redis": redis,
        "costs": {
            "total_30d_usd": round(total_cost_30d, 2),
            "daily_avg_usd": round(total_cost_30d / 30, 2),
            "breakdown": costs[:10],
        },
        "security": {
            "findings": security,
            "critical_count": sum(1 for f in security if f["severity"] == "HIGH"),
            "warning_count": sum(1 for f in security if f["severity"] == "MEDIUM"),
        },
    }), 200


@admin_infra_bp.route("/logs", methods=["GET"])
@jwt_required()
def infra_logs():
    err = _require_super_admin()
    if err:
        return err

    service = request.args.get("service", "api")
    search = request.args.get("search", "").strip() or None
    limit = min(int(request.args.get("limit", 100)), 200)

    log_group = f"/ecs/{PROJECT_NAME}/{service}"
    events = _fetch_cloudwatch_logs(log_group, search, limit=limit)

    return jsonify({
        "log_group": log_group,
        "search": search,
        "count": len(events),
        "events": events,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }), 200


@admin_infra_bp.route("/costs", methods=["GET"])
@jwt_required()
def infra_costs():
    err = _require_super_admin()
    if err:
        return err

    costs = _fetch_cost_by_service()
    total = sum(c["total_usd"] for c in costs)

    return jsonify({
        "period_days": 30,
        "total_usd": round(total, 2),
        "breakdown": costs,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }), 200


@admin_infra_bp.route("/scale", methods=["POST"])
@jwt_required()
def scale_service():
    """
    Ajusta o desired_count de um serviço ECS.
    Body: { "service": "api" | "frontend", "desired_count": 1-10 }
    """
    err = _require_super_admin()
    if err:
        return err

    data = request.get_json() or {}
    service_name = data.get("service", "").strip()
    desired = data.get("desired_count")

    if service_name not in ("api", "frontend"):
        return jsonify({"error": "bad_request", "message": "service deve ser 'api' ou 'frontend'"}), 400

    if not isinstance(desired, int) or not (1 <= desired <= 10):
        return jsonify({"error": "bad_request", "message": "desired_count deve ser inteiro entre 1 e 10"}), 400

    full_service_name = f"{PROJECT_NAME}-{service_name}"
    cluster_name = f"{PROJECT_NAME}-cluster"

    client = _get_boto_client("ecs")
    if not client:
        return jsonify({"error": "aws_unavailable", "message": "Não foi possível conectar à AWS"}), 503

    try:
        resp = client.update_service(
            cluster=cluster_name,
            service=full_service_name,
            desiredCount=desired,
        )
        svc = resp.get("service", {})
        return jsonify({
            "message": f"Serviço {full_service_name} atualizado para {desired} task(s).",
            "service": full_service_name,
            "desired_count": svc.get("desiredCount"),
            "running_count": svc.get("runningCount"),
            "status": svc.get("status"),
        }), 200
    except Exception as e:
        logger.error(f"ECS update_service falhou: {e}")
        return jsonify({"error": "scale_failed", "message": str(e)}), 500


@admin_infra_bp.route("/cost-optimization", methods=["GET"])
@jwt_required()
def cost_optimization():
    """
    Analisa a infra atual e retorna recomendações de otimização de custo.
    """
    err = _require_super_admin()
    if err:
        return err

    recommendations = []
    total_savings_estimate = 0.0

    ecs_services = _fetch_ecs_services()
    rds = _fetch_rds_status()
    redis = _fetch_elasticache_status()
    costs = _fetch_cost_by_service()

    # 1. Tasks ECS ociosas (CPU < 10% com múltiplas tasks)
    metrics = _fetch_ecs_metrics()
    for svc in ecs_services:
        svc_metrics = metrics.get(svc["name"], {})
        cpu = svc_metrics.get("cpu_percent")
        running = svc["running_count"]
        if cpu is not None and cpu < 10 and running > 1:
            saving = running - 1  # tasks que podem ser removidas
            # API task ~$0.0255/h (512 vCPU + 1GB), frontend ~$0.013/h (256 vCPU + 512MB)
            hourly = 0.0255 if "api" in svc["name"] else 0.013
            monthly_saving = saving * hourly * 24 * 30
            total_savings_estimate += monthly_saving
            recommendations.append({
                "priority": "HIGH",
                "category": "ECS",
                "resource": svc["name"],
                "title": f"Reduzir tasks de {running} para 1",
                "description": f"CPU média de apenas {cpu}% com {running} tasks rodando. "
                               f"1 task é suficiente para essa carga.",
                "action": "scale_down",
                "current_value": running,
                "recommended_value": 1,
                "estimated_saving_monthly_usd": round(monthly_saving, 2),
            })

    # 2. RDS db.t3.micro com uso baixo — já é o menor, mas pode sugerir Aurora Serverless
    if rds and rds.get("instance_class") == "db.t3.micro":
        recommendations.append({
            "priority": "LOW",
            "category": "RDS",
            "resource": rds.get("identifier"),
            "title": "Considerar Aurora Serverless v2 no futuro",
            "description": "db.t3.micro (~$13/mês) é uma boa escolha para esta fase. "
                           "Quando o volume crescer, Aurora Serverless escala automaticamente.",
            "action": "info",
            "estimated_saving_monthly_usd": 0,
        })

    # 3. RDS sem Multi-AZ — já está desabilitado (bom para custo)
    if rds and not rds.get("multi_az"):
        recommendations.append({
            "priority": "INFO",
            "category": "RDS",
            "resource": rds.get("identifier"),
            "title": "Multi-AZ desabilitado (correto para dev/staging)",
            "description": "Sem Multi-AZ economiza ~100% do custo de standby (~$13/mês). "
                           "Habilite apenas em produção com SLA exigido.",
            "action": "info",
            "estimated_saving_monthly_usd": 0,
        })

    # 4. Análise de custos por serviço
    top_costs = [c for c in costs if c["total_usd"] > 5]
    for cost_item in top_costs[:3]:
        if "Elastic Container Service" in cost_item["service"] or "EC2" in cost_item["service"]:
            recommendations.append({
                "priority": "MEDIUM",
                "category": "ECS",
                "resource": cost_item["service"],
                "title": f"Maior custo: {cost_item['service']}",
                "description": f"${cost_item['total_usd']:.2f} nos últimos 30 dias "
                               f"(~${cost_item['daily_avg_usd']:.2f}/dia). "
                               "Reduzir tasks em horários de baixo uso pode economizar até 40%.",
                "action": "info",
                "estimated_saving_monthly_usd": round(cost_item["total_usd"] * 0.3, 2),
            })

    # 5. Sem recomendações críticas
    if not any(r["priority"] == "HIGH" for r in recommendations):
        recommendations.insert(0, {
            "priority": "OK",
            "category": "GERAL",
            "resource": "all",
            "title": "Infraestrutura otimizada",
            "description": "Nenhuma oportunidade crítica de economia identificada no momento.",
            "action": "info",
            "estimated_saving_monthly_usd": 0,
        })

    return jsonify({
        "recommendations": recommendations,
        "total_estimated_saving_monthly_usd": round(total_savings_estimate, 2),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }), 200