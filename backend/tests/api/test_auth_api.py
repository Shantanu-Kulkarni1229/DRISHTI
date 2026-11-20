def test_register_and_login_flow(client):
    # Register
    reg_payload = {
        "email": "captain.verma@example.com",
        "password": "strongPassword1234!",
        "display_name": "Capt. Verma",
        "organisation_name": "Western Command",
        "role": "analyst",
    }
    reg_res = client.post("/api/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    data = reg_res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "captain.verma@example.com"

    # Login
    login_payload = {
        "email": "captain.verma@example.com",
        "password": "strongPassword1234!",
    }
    login_res = client.post("/api/auth/login", json=login_payload)
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert "access_token" in login_data
    assert "refresh_token" in login_data

    # Refresh
    ref_res = client.post("/api/auth/refresh", json={"refresh_token": login_data["refresh_token"]})
    assert ref_res.status_code == 200
    assert "access_token" in ref_res.json()

    # Me
    me_res = client.get("/api/auth/me")
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "analyst@test.local"
