    ('ATV', '4-Wheeler', 'moto', 50000, 20, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/placeholder.png', '{"max_speed": "60 MPH", "year": "2020"}', true),
    ('Lawn', 'Mower', 'moto', 40000, 15, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/1/1f/Lawn_Mower.png/revision/latest?cb=20240416152404', '{"max_speed": "11 MPH", "year": "2018"}', true)


ON CONFLICT (make, model) DO NOTHING;
