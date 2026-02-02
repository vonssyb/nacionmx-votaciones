-- Semilla de Datos para el Concesionario (Vehículos Reales)

INSERT INTO dealership_catalog (make, model, category, price, stock, image_url, specs, finance_available)
VALUES
    -- TRABAJO / CARGA
    ('Chevlon', 'Camión 2018', 'trabajo', 70000, 10, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/f/fe/Chevlon_Camion_2018.png/revision/latest?cb=20221231084205', '{"max_speed": "131 MPH"}', true),
    ('Chevlon', 'Camion 2021', 'trabajo', 110000, 10, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/4/44/Chevlon_Camion_2021.png/revision/latest?cb=20221231100945', '{"max_speed": "128 MPH"}', true),
    ('Falcon', 'Rampage Beast 2021', 'trabajo', 210000, 5, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/0/0f/Falcon_Rampage_Beast_2021.png/revision/latest?cb=20241110123541', '{"max_speed": "99 MPH"}', true),
    ('Celestial', 'Truckatron 2024', 'trabajo', 400000, 3, 'https://emergency-response-liberty-county.fandom.com/wiki/Celestial_Truckatron_2024?file=Celestial_Truckatron_2024.png', '{"max_speed": "122 MPH"}', true),

    -- DEPORTIVO
    ('Falcon', 'Scavenger 2016', 'deportivo', 60000, 15, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/4/4a/Falcon_Scavenger_2016.png/revision/latest?cb=20240601191314', '{"max_speed": "126 MPH"}', true),
    ('Celestial', 'Type-6 2023', 'deportivo', 70000, 10, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/9/96/Celestial_Type-6_2023.png/revision/latest?cb=20240428143713', '{"max_speed": "145 MPH"}', true),
    ('Falcon', 'eStallion 2024', 'deportivo', 100000, 10, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/e/e2/Falcon_eStallion_2024.png/revision/latest?cb=20240429113243', '{"max_speed": "124 MPH"}', true),
    ('Chevlon', 'Corbeta X08 2014', 'deportivo', 230000, 5, 'https://emergency-response-liberty-county.fandom.com/wiki/Chevlon_Corbeta_X08_2014?file=Chevlon_Corbeta_X08_2014.png', '{"max_speed": "153 MPH"}', true),
    ('Falcon', 'Stallion 350 2015', 'deportivo', 300000, 5, 'https://emergency-response-liberty-county.fandom.com/wiki/Falcon_Stallion_350_2015?file=Falcon_Stallion_350_2015.png', '{"max_speed": "125 MPH"}', true),
    ('Ferdinand', 'Jalapeño Turbo 2022', 'deportivo', 260000, 5, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/e/ea/Ferdinand_Jalapeno_Turbo_2022.png/revision/latest?cb=20230405030413', '{"max_speed": "155 MPH"}', true),
    ('BKM', 'Risen Roadster 2020', 'deportivo', 350000, 3, 'https://emergency-response-liberty-county.fandom.com/wiki/BKM_Risen_Roadster_2020?file=BKM_Risen_Roadster_2020.png', '{"max_speed": "146 MPH"}', true),
    ('Chevlon', 'Corbeta RZR 2014', 'deportivo', 460000, 2, 'https://emergency-response-liberty-county.fandom.com/wiki/Chevlon_Corbeta_RZR_2014?file=Chevlon_Corbeta_TZ_2014.png', '{"max_speed": "163 MPH"}', true),
    ('Chevlon', 'Corbeta 8 2023', 'deportivo', 390000, 3, 'https://emergency-response-liberty-county.fandom.com/wiki/Chevlon_Corbeta_8_2023?file=Chevlon_Corbeta_8_2023.png', '{"max_speed": "157 MPH"}', true),
    ('Falcon', 'Heritage 2021', 'deportivo', 480000, 2, 'https://emergency-response-liberty-county.fandom.com/wiki/Falcon_Heritage_2021?file=Falcon_Heritage_2021.png', '{"max_speed": "168 MPH"}', true),
    ('Averon', 'R8 2017', 'deportivo', 420000, 3, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/b/b5/Averon_R8_2017.png/revision/latest?cb=20230521193930', '{"max_speed": "146 MPH"}', true),
    ('Surrey', '650S 2016', 'deportivo', 380000, 2, 'https://emergency-response-liberty-county.fandom.com/wiki/Chevlon_Corbeta_8_2023?file=Chevlon_Corbeta_8_2023.png', '{"max_speed": "150 MPH"}', true),

    -- SUV / CAMIONETAS
    ('Navara', 'Boundary 2022', 'suv', 80000, 10, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/0/05/Navara_Boundary_2022.png/revision/latest?cb=20250106215305', '{"max_speed": "140 MPH"}', true),
    ('Bullhorn', 'Prancer 2015', 'suv', 90000, 10, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/5/50/Bullhorn_Prancer_2015.png/revision/latest?cb=20221231074716', '{"max_speed": "133 MPH"}', true),
    ('Chevlon', 'Amigo Sport 2018', 'suv', 150000, 10, 'https://emergency-response-liberty-county.fandom.com/wiki/Chevlon_Amigo_Sport_2016?file=Chevlon_Amigo_Sport_2016.png', '{"max_speed": "121 MPH"}', true),
    ('Chevlon', 'Amigo LZR 2011', 'suv', 140000, 10, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/f/f4/Chevlon_Amigo_LZR_2011_main.png/revision/latest?cb=20240719183806', '{"max_speed": "133 MPH"}', true),
    ('Chevlon', 'Platoro 2019', 'suv', 120000, 10, 'https://emergency-response-liberty-county.fandom.com/wiki/Chevlon_Platoro_2019?file=Chevlon_Platoro_2019.png', '{"max_speed": "131 MPH"}', true),
    ('Vellfire', 'Prairie 2022', 'suv', 100000, 10, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/4/4c/Vellfire_Prairie_2022.png/revision/latest?cb=20240429160334', '{"max_speed": "131 MPH"}', true),
    ('Overland', 'Apache SFP 2020', 'suv', 130000, 5, 'https://emergency-response-liberty-county.fandom.com/wiki/Overland_Apache_SFP_2020?file=Overland_Apache_SFP_2020.png', '{"max_speed": "147 MPH"}', true),
    ('Bullhorn', 'Prancer Widebody 2020', 'suv', 250000, 5, 'https://emergency-response-liberty-county.fandom.com/wiki/Bullhorn_Prancer_Widebody_2020?file=Bullhorn_Prancer_Widebody_2020.png', '{"max_speed": "136 MPH"}', true),
    ('Bullhorn', 'Determinator SFP Blackjack 2022', 'suv', 270000, 3, 'https://emergency-response-liberty-county.fandom.com/wiki/Bullhorn_Determinator_SFP_Blackjack_Widebody_2022?file=Bullhorn_Determinator_SFP_Blackjack_Widebody_2022.png', '{"max_speed": "162 MPH"}', true),
    ('Averon', 'Q8 2022', 'suv', 340000, 5, 'https://emergency-response-liberty-county.fandom.com/wiki/Averon_Q8_2022?file=Averon_Q8_2022.png', '{"max_speed": "125 MPH"}', true),
    ('Navara', 'Horizon 2013', 'suv', 430000, 5, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/7/79/Navara_Horizon_2013.png/revision/latest?cb=20240504223936', '{"max_speed": "157 MPH"}', true),

    -- SEDAN
    ('Averon', 'Anodic 2024', 'sedan', 80000, 10, 'https://emergency-response-liberty-county.fandom.com/wiki/Averon_Anodic_2024?file=Averon_Anodic_2024.png', '{"max_speed": "119 MPH"}', true),
    ('Averon', 'S5 2010', 'sedan', 190000, 8, 'https://emergency-response-liberty-county.fandom.com/wiki/Averon_S5_2010?file=Averon_S5_2010.png', '{"max_speed": "117 MPH"}', true),

    -- LUJO
    ('Leland', 'Vault 2020', 'lujo', 200000, 5, 'https://emergency-response-liberty-county.fandom.com/wiki/Leland_Vault_2020?file=Leland_Vault_2020.png', '{"max_speed": "125 MPH"}', true),
    ('Strugatti', 'Ettore 2020', 'lujo', 500000, 2, 'https://emergency-response-liberty-county.fandom.com/wiki/Strugatti_Ettore_2020?file=Strugatti_Ettore_2020.png', '{"max_speed": "170 MPH"}', true),
    ('Kovac', 'Heladera 2023', 'lujo', 600000, 1, 'https://emergency-response-liberty-county.fandom.com/wiki/Kovac_Heladera_2023?file=Kovac_Heladera_2023.jpeg', '{"max_speed": "180 MPH"}', true)
ON CONFLICT DO NOTHING;
