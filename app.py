from flask import Flask, jsonify, request, render_template, send_from_directory, redirect, url_for, session
import sqlite3
import os

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-key")

DB_PATH = os.path.join(os.path.dirname(__file__), "quotes.db")


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS quotes (
                order_number INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_first_name TEXT NOT NULL,
                customer_last_name TEXT NOT NULL,
                customer_birthdate TEXT,
                tax_code TEXT,
                item_type TEXT,
                item_code TEXT,
                description TEXT,
                unit TEXT,
                quantity REAL,
                unit_price REAL,
                total_price REAL,
                mr_unit_price REAL,
                mr_total_price REAL,
                mr_markup REAL,
                labor_unit_price REAL,
                labor_total_price REAL,
                labor_markup REAL,
                pm_unit_price REAL,
                pm_total_price REAL,
                cm_unit_price REAL,
                cm_total_price REAL
            )
            """
        )


def row_to_dict(row):
    return {k: row[k] for k in row.keys()}


def validate_data(data, is_create=False):
    errors = {}
    required = [
        "customer_first_name",
        "customer_last_name",
        "customer_birthdate",
        "tax_code",
        "item_type",
        "item_code",
        "description",
        "unit",
        "quantity",
        "unit_price",
        "total_price",
        "mr_unit_price",
        "mr_total_price",
        "mr_markup",
        "labor_unit_price",
        "labor_total_price",
        "labor_markup",
        "pm_unit_price",
        "pm_total_price",
        "cm_unit_price",
        "cm_total_price",
    ]
    numeric = [
        "quantity",
        "unit_price",
        "total_price",
        "mr_unit_price",
        "mr_total_price",
        "mr_markup",
        "labor_unit_price",
        "labor_total_price",
        "labor_markup",
        "pm_unit_price",
        "pm_total_price",
        "cm_unit_price",
        "cm_total_price",
    ]

    # Required fields for creation; for update, validate if provided
    for f in required:
        if f not in data:
            errors[f] = "campo obbligatorio"
            continue
        v = data.get(f)
        if v is None or (isinstance(v, str) and not v.strip()):
            errors[f] = "campo obbligatorio"

    # Numbers must be non-negative; quantity must be > 0
    for f in numeric:
        if f not in data or data.get(f) is None or (isinstance(data.get(f), str) and not data.get(f).strip()):
            errors[f] = "campo obbligatorio"
            continue
        try:
            val = float(data.get(f))
        except (TypeError, ValueError):
            errors[f] = "deve essere un numero"
            continue
        if val < 0:
            errors[f] = "non può essere negativo"
        if f == "quantity" and val <= 0:
            errors[f] = "deve essere maggiore di 0"

    # Consistenza totale = quantità × prezzo unitario, se tutti presenti
    if (
        data.get("quantity") is not None
        and data.get("unit_price") is not None
        and data.get("total_price") is not None
    ):
        try:
            q = float(data.get("quantity"))
            u = float(data.get("unit_price"))
            t = float(data.get("total_price"))
            expected = round(q * u, 2)
            if round(t, 2) != expected:
                errors["total_price"] = "non coerente con quantità × prezzo unitario"
        except Exception:
            pass

    return errors


@app.route("/")
def index():
    if not session.get("auth"):
        return render_template("login.html", error=None)
    return render_template("index.html")


@app.route("/login", methods=["POST"])
def login():
    name = request.form.get("name") or (request.get_json(silent=True) or {}).get("name")
    password = request.form.get("password") or (request.get_json(silent=True) or {}).get("password")
    if name == "Davide" and password == "Ferrari":
        session["auth"] = True
        return redirect(url_for("index"))
    return render_template("login.html", error="Credenziali non valide"), 401


@app.route("/api/quotes", methods=["GET"])
def list_quotes():
    if not session.get("auth"):
        return jsonify({"error": "unauthorized"}), 401
    q = request.args.get("q", "").strip()
    with get_conn() as conn:
        if q:
            parts = [p for p in q.split(" ") if p]
            if len(parts) == 1:
                like = f"%{parts[0]}%"
                rows = conn.execute(
                    """
                    SELECT order_number, item_code, customer_first_name, customer_last_name
                    FROM quotes
                    WHERE customer_first_name LIKE ? OR customer_last_name LIKE ?
                    ORDER BY order_number DESC
                    """,
                    (like, like),
                ).fetchall()
            else:
                like_a = f"%{parts[0]}%"
                like_b = f"%{parts[1]}%"
                rows = conn.execute(
                    """
                    SELECT order_number, item_code, customer_first_name, customer_last_name
                    FROM quotes
                    WHERE (customer_first_name LIKE ? AND customer_last_name LIKE ?) OR (customer_first_name LIKE ? AND customer_last_name LIKE ?)
                    ORDER BY order_number DESC
                    """,
                    (like_a, like_b, like_b, like_a),
                ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT order_number, item_code, customer_first_name, customer_last_name
                FROM quotes
                ORDER BY order_number DESC
                """
            ).fetchall()
    return jsonify([row_to_dict(r) for r in rows])


@app.route("/api/autocomplete", methods=["GET"])
def autocomplete():
    if not session.get("auth"):
        return jsonify([])
    q = request.args.get("q", "").strip()
    suggestions = []
    if q:
        like = f"%{q}%"
        with get_conn() as conn:
            rows = conn.execute(
                """
                SELECT DISTINCT customer_first_name, customer_last_name
                FROM quotes
                WHERE customer_first_name LIKE ? OR customer_last_name LIKE ?
                ORDER BY customer_last_name ASC, customer_first_name ASC
                LIMIT 10
                """,
                (like, like),
            ).fetchall()
            suggestions = [f"{r['customer_first_name']} {r['customer_last_name']}".strip() for r in rows]
    return jsonify(suggestions)


@app.route("/api/quote/<int:order_number>", methods=["GET"])
def get_quote(order_number: int):
    if not session.get("auth"):
        return jsonify({"error": "unauthorized"}), 401
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM quotes WHERE order_number = ?",
            (order_number,),
        ).fetchone()
        if not row:
            return jsonify({"error": "not_found"}), 404
        return jsonify(row_to_dict(row))


@app.route("/api/quote", methods=["POST"])
def create_quote():
    if not session.get("auth"):
        return jsonify({"error": "unauthorized"}), 401
    data = request.get_json(force=True) or {}
    fields = [
        "customer_first_name",
        "customer_last_name",
        "customer_birthdate",
        "tax_code",
        "item_type",
        "item_code",
        "description",
        "unit",
        "quantity",
        "unit_price",
        "total_price",
        "mr_unit_price",
        "mr_total_price",
        "mr_markup",
        "labor_unit_price",
        "labor_total_price",
        "labor_markup",
        "pm_unit_price",
        "pm_total_price",
        "cm_unit_price",
        "cm_total_price",
    ]
    # validate
    errs = validate_data(data, is_create=True)
    if errs:
        return jsonify({"errors": errs}), 400

    with get_conn() as conn:
        cur = conn.execute(
            f"INSERT INTO quotes ({', '.join(fields)}) VALUES ({', '.join(['?' for _ in fields])})",
            [data.get(f) for f in fields],
        )
        order_number = cur.lastrowid
    return jsonify({"order_number": order_number}), 201


@app.route("/api/quote/<int:order_number>", methods=["PUT"])
def update_quote(order_number: int):
    if not session.get("auth"):
        return jsonify({"error": "unauthorized"}), 401
    data = request.get_json(force=True) or {}
    updatable = [
        "customer_first_name",
        "customer_last_name",
        "customer_birthdate",
        "tax_code",
        "item_type",
        "item_code",
        "description",
        "unit",
        "quantity",
        "unit_price",
        "total_price",
        "mr_unit_price",
        "mr_total_price",
        "mr_markup",
        "labor_unit_price",
        "labor_total_price",
        "labor_markup",
        "pm_unit_price",
        "pm_total_price",
        "cm_unit_price",
        "cm_total_price",
    ]
    # validate only provided fields
    errs = validate_data(data, is_create=False)
    if errs:
        return jsonify({"errors": errs}), 400

    set_parts = []
    values = []
    for f in updatable:
        if f in data:
            set_parts.append(f"{f} = ?")
            values.append(data.get(f))
    if not set_parts:
        return jsonify({"updated": 0})
    values.append(order_number)
    with get_conn() as conn:
        conn.execute(
            f"UPDATE quotes SET {', '.join(set_parts)} WHERE order_number = ?",
            values,
        )
    return jsonify({"updated": 1})


@app.route("/api/quote/<int:order_number>", methods=["DELETE"])
def delete_quote(order_number: int):
    if not session.get("auth"):
        return jsonify({"error": "unauthorized"}), 401
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM quotes WHERE order_number = ?", (order_number,))
    return jsonify({"deleted": cur.rowcount})


@app.route("/static/<path:filename>")
def static_files(filename):
    return send_from_directory(os.path.join(app.root_path, "static"), filename)


init_db()

if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)