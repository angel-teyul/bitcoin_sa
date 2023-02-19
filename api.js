// paquete para conexion/solitud a base de datos
const sql = require('mssql')


// paquete para montar el servidor web
const express = require('express')
const app = express()
const port = 3000


// paquete para encriptar/desencriptar la contraseña
const bcrypt = require('bcrypt')


// paquete para hacer un parse a las solicitudes
// y obtener datos de formulario
const bodyParser = require('body-parser')


// configuracion usuario para conexion a SQL Server
const config = {
    user: 'bitcoin',
    password: '12345',
    server: 'MSI',
    database: 'Banca_BitcoinSA',
    options: {
        trustedconnection: false,
        enableArithAbort: true,
        encrypt: false
    }
}


// codificar caracteres correctamente en caso de ser necesario
app.use(bodyParser.urlencoded({ extended: true }))


// configurar motor de vistas (views)
app.set('view engine', 'ejs')
app.set('views', __dirname + "/views")


// fijar directorio raiz
app.use(express.static(__dirname + '/public'));


// cargar mensaje de ser necesario
var mensajeInicio = '',
    loginInvalido = ''

// cargar pagina inicio
app.get('/', (req, res) => {
    if (sesionActiva === true) {
        res.redirect('/user')
    } else {
        mensajeAlerta = ''
        res.render('index', {
            url: '/register',
            message: mensajeInicio,
            invalidLogin: loginInvalido
        })
        loginInvalido = ''
    }
    // res.send('Respuesta de Express')
})


// cargar pagina registro
var mensajeAlerta = ''

app.get('/register', (req, res) => {
    res.render('register', {
        url: '/',
        alertMessage: mensajeAlerta
    })
})


// verificar sesion activa
var sesionActiva = false,
    resultadoTransaccion = ''

// cargar pagina usuario
app.get('/user', (req, res) => {
    if (sesionActiva) {
        return res.render('user', {
            idcliente: datosCliente.CodigoCliente,
            nombre: datosCliente.NombreCompleto,
            cuentas: cuentasCliente,
            vals: cuentasCliente.length,
            mensaje: resultadoTransaccion,
            datos: datosCliente,
            pass: passCliente
        })
    } else {
        resultadoTransaccion = ''
        mensajeInicio = ''
        loginInvalido = ''
        mensajeAlerta = ''
        return res.redirect('/')
    }
})


// almacenar los datos del usuario
var datosCliente,
    passCliente,
    cuentasCliente = ''


/* ------------------------------
---------- inicio sesion --------
------------------------------ */


app.post('/login', function (req, res) {
    var correo = req.body.CorreoElectronico
    var pass = req.body.Contrasena

    // conexion al servidor para validar usuario
    sql.connect(config).then(pool => {
        // ejecutar stored procedure
        return result = pool.request()
            .input('Accion', 'S')
            .input('JSON', `{"CorreoElectronico": "${correo}"}`)
            .execute('sp_Cliente')
    }).then(result => {
        var dataUsuario = result.recordset[0]

        if (dataUsuario[Object.keys(dataUsuario)[0]] === '') {
            loginInvalido = '¡Usuario no existente o credenciales no válidas!'
            return res.redirect('/')
        } else {
            // obtener datos JSON
            var datosJSON = []

            for (let key in dataUsuario) {
                datosJSON = dataUsuario[key]
            }

            var objDatos = JSON.parse(datosJSON)
            datosCliente = objDatos.Lista_Cliente[0]

            var validPassword = bcrypt.compareSync(pass, datosCliente.Contrasena)

            // si la contraseña es valida se cargan las cuentas del cliente
            if (validPassword) {
                passCliente = pass
                // obtener cuentas
                sql.connect(config).then(pool => {
                    return result = pool.request()
                        .input('Accion', 'S')
                        .input('JSON', `{"CodigoCliente": ${datosCliente.CodigoCliente}}`)
                        .execute('sp_CuentaxCliente')
                }).then(result => {
                    var dataCuentas = result.recordset[0]

                    if (dataCuentas[Object.keys(dataCuentas)[0]] !== '') {
                        // obtener datos JSON
                        var cuentasJSON = []

                        for (let key in dataCuentas) {
                            cuentasJSON = dataCuentas[key]
                        }

                        var objDatos = JSON.parse(cuentasJSON)
                        cuentasCliente = objDatos.Lista_CuentaxCliente
                    }
                }).catch(err => {
                    console.log(err)
                })
            } else {
                // contraseña no coincide
                loginInvalido = '¡Usuario no existente o credenciales no validas!'
                return res.redirect('/')
            }

            // redirigir a la pagina de usuario si se valido la cuenta
            setTimeout(function () {
                resultadoTransaccion = ''
                loginInvalido = ''
                sesionActiva = true
                return res.redirect('/user')
            }, 2000)
        }
    }).catch(err => {
        console.log(err)
    })
})


/* ------------------------------
---------- cerrar sesión --------
------------------------------ */


app.post('/logout', function (req, res) {
    // reiniciar datos
    datosCliente = ''
    cuentasCliente = ''
    sesionActiva = false

    resultadoTransaccion = ''
    mensajeInicio = ''
    mensajeAlerta = ''
    loginInvalido = ''
    return res.redirect('/')
})


/* ------------------------------
---------- crear usuario --------
------------------------------ */


app.post('/registrar-usuario', function (req, res) {
    // obtener datos del formulario
    var PrimerNombre = req.body.PrimerNombre,
        SegundoNombre = req.body.SegundoNombre,
        PrimerApellido = req.body.PrimerApellido,
        SegundoApellido = req.body.SegundoApellido,
        TipoIdentificacion = req.body.TipoIdentificacion,
        Identificacion = req.body.Identificacion,
        FechaNacimiento = req.body.FechaNacimiento,
        Telefono = req.body.Telefono,
        Direccion = req.body.Direccion,
        CorreoElectronico = req.body.CorreoElectronico,
        Contrasena = req.body.Contrasena,
        nuevoHash = bcrypt.hashSync(Contrasena, 9)


    // verificar que no exista un usuario con ese correo
    sql.connect(config).then(pool => {
        return pool.request()
            .query(`select CodigoCliente from Cliente where CorreoElectronico = '${CorreoElectronico}'`)
    }).then(result => {
        if (result.recordsets[0].length > 0) {
            mensajeAlerta = '¡Ya existe una cuenta con ese correo, por favor use otro!'
            return res.redirect('/register')
        } else {
            // conexion al servidor para insertar usuario
            sql.connect(config).then(pool => {
                // ejecutar stored procedure
                return result = pool.request()
                    .input('Accion', 'I')
                    .input('JSON', `{
                        "Identificacion": "${Identificacion}",
                        "TipoIdentificacion": "${TipoIdentificacion}",
                        "PrimerNombre": "${PrimerNombre}",
                        "SegundoNombre": "${SegundoNombre}",
                        "PrimerApellido": "${PrimerApellido}",
                        "SegundoApellido": "${SegundoApellido}",
                        "FechaNacimiento": "${FechaNacimiento}",
                        "Telefono": "${Telefono}",
                        "Direccion": "${Direccion}",
                        "CorreoElectronico": "${CorreoElectronico}",
                        "Contrasena": "${nuevoHash}"
                    }`)
                    .execute('sp_Cliente')
            }).then(result => {
                // enviar a la pagina de login
                mensajeInicio = 'Usuario creado exitosamente!'
                resultadoTransaccion = ''
                mensajeAlerta = ''
                loginInvalido = ''
                return res.redirect('/')
            }).catch(err => {
                console.log(err)
            })
        }
    }).catch(err => {
        console.log(err)
    });
})


/* ------------------------------
---------- crear cuenta ---------
------------------------------ */

app.post('/crear-cuenta', function (req, res) {
    var CodigoCliente = req.body.CodigoCliente
    var TipoCuenta = req.body.TipoCuenta


    // conexion al servidor para agregar cuenta
    sql.connect(config).then(pool => {
        // ejecutar stored procedure
        return result = pool.request()
            .input('Accion', 'I')
            .input('JSON', `{
                "CodigoCliente": "${CodigoCliente}",
                "TipoCuenta": "${TipoCuenta}"
            }`)
            .execute('sp_CuentaxCliente')
    }).then(result => {
        // actualizar pagina usuario
        sql.connect(config).then(pool => {
            return result = pool.request()
                .input('Accion', 'S')
                .input('JSON', `{"CodigoCliente": ${datosCliente.CodigoCliente}}`)
                .execute('sp_CuentaxCliente')
        }).then(result => {
            var dataCuentas = result.recordset[0]

            if (dataCuentas[Object.keys(dataCuentas)[0]] !== '') {
                // obtener datos JSON
                var cuentasJSON = []

                for (let key in dataCuentas) {
                    cuentasJSON = dataCuentas[key]
                }

                var objDatos = JSON.parse(cuentasJSON)
                cuentasCliente = objDatos.Lista_CuentaxCliente
            }
        }).catch(err => {
            console.log(err)
        })

        // actualizar pagina de usuario
        setTimeout(function () {
            resultadoTransaccion = '¡Cuenta creada con éxito!'
            sesionActiva = true
            return res.redirect('/user')
        }, 2000)

    }).catch(err => {
        console.log(err)
    })
})


/* ------------------------------
---------- borrar cuenta --------
------------------------------ */

app.post('/eliminar-cuenta', function (req, res) {
    var idCuenta = req.body.CodigoCuenta
    CodigoCliente = datosCliente.CodigoCliente

    // conexion al servidor para eliminar cuenta
    sql.connect(config).then(pool => {
        // ejecutar stored procedure
        return result = pool.request()
            .input('Accion', 'D')
            // IDUsuario
            .input('JSON', `{
                "CodigoCuenta": ${idCuenta},
                "CodigoCliente": ${CodigoCliente}
            }`)
            .execute('sp_CuentaxCliente')
    }).then(result => {
        var cantidadCuentas = cuentasCliente.length

        // actualizar cuentas en pagina usuario
        sql.connect(config).then(pool => {
            return result = pool.request()
                .input('Accion', 'S')
                .input('JSON', `{"CodigoCliente": ${CodigoCliente}}`)
                .execute('sp_CuentaxCliente')
        }).then(result => {
            var dataCuentas = result.recordset[0]

            if (dataCuentas[Object.keys(dataCuentas)[0]] !== '') {
                // obtener datos JSON
                var cuentasJSON = []

                for (let key in dataCuentas) {
                    cuentasJSON = dataCuentas[key]
                }

                var objDatos = JSON.parse(cuentasJSON)
                cuentasCliente = objDatos.Lista_CuentaxCliente

                if (cuentasCliente.length === cantidadCuentas) {
                    // no se borró la cuenta
                    sesionActiva = true
                    resultadoTransaccion = '¡Cuenta no eliminada! Puede que la cuenta no exista en su usario o tenga saldo en la misma.'
                    return res.redirect('/user')
                } else {
                    // recargar pagina de usuario
                    sesionActiva = true
                    resultadoTransaccion = '¡Cuenta eliminada con éxito!'
                    return res.redirect('/user')
                }
            } else {
                cuentasCliente = ''
            }
        }).catch(err => {
            console.log(err)
        })

    }).catch(err => {
        console.log(err)
    })
})


/* ------------------------------
----------- transferir ----------
------------------------------ */

app.post('/transferir', function (req, res) {
    var codigoClienteOrigen = req.body.codigoCliente,
        codigoCuentaOrigen = req.body.cuentaOrigen,
        tipoCuentaOrigen,
        saldoOrigen,
        codigoClienteDestino,
        codigoCuentaDestino = req.body.cuentaDestino,
        tipoCuentaDestino = req.body.tipoCuentaDestino,
        saldoDestino,
        montoTransferir = req.body.montoTransferir

    // obtener datos restantes cuenta de origen (tipoCuenta, saldo)
    sql.connect(config).then(pool => {
        return result = pool.request()
            .query(`select Saldo, Tipocuenta from CuentaxCliente where CodigoCliente = '${codigoClienteOrigen}' and CodigoCuenta = '${codigoCuentaOrigen}'`)
    }).then(result => {
        var datosOrigen = result.recordset[0]
        console.log(datosOrigen)
        tipoCuentaOrigen = datosOrigen.Tipocuenta
        saldoOrigen = datosOrigen.Saldo

        // validar si cuenta destino existe/datos correctos (saldo, codigoClienteDestino)
        sql.connect(config).then(pool => {
            return result = pool.request()
                .query(`select Saldo, CodigoCliente from CuentaxCliente where CodigoCuenta = '${codigoCuentaDestino}' and Tipocuenta = ${tipoCuentaDestino}`)
        }).then(result => {
            var datosDestino = result.recordset[0]

            // determinar si se transfiere o no
            if (datosDestino === undefined) {
                resultadoTransaccion = '¡Transferencia no completada!, por favor verifique los datos.'
                return res.redirect('/user')
            } else {
                codigoClienteDestino = datosDestino.CodigoCliente
                saldoDestino = datosDestino.Saldo

                var nuevoSaldoOrigen = saldoOrigen - Number(montoTransferir)
                nuevoSaldoDestino = saldoDestino + Number(montoTransferir)

                // insertar registro de transaccion
                sql.connect(config).then(pool => {
                    return result = pool.request()
                        .input('Accion', 'I')
                        .input('JSON', `{
                            "CuentaOrigen": ${codigoCuentaOrigen},
                            "CuentaDestino": ${codigoCuentaDestino},
                            "Monto": ${montoTransferir},
                            "CodigoCliente": ${codigoClienteOrigen},
                            "TipoTransaccion": 1
                        }`)
                        .execute('sp_Transaccion')
                }).then(result => {
                    // actualizar saldo cuenta origen
                    sql.connect(config).then(pool => {
                        return result = pool.request()
                            .input('Accion', 'U')
                            .input('JSON', `{
                                "CodigoCliente": ${codigoClienteOrigen},
                                "TipoCuenta": ${tipoCuentaOrigen},
                                "Saldo": ${nuevoSaldoOrigen},
                                "CodigoCuenta": ${codigoCuentaOrigen}
                            }`)
                            .execute('sp_CuentaxCliente')
                    }).then(result => {
                        // actualizar saldo cuenta destino
                        sql.connect(config).then(pool => {
                            return result = pool.request()
                                .input('Accion', 'U')
                                .input('JSON', `{
                                "CodigoCliente": ${codigoClienteDestino},
                                "TipoCuenta": ${tipoCuentaDestino},
                                "Saldo": ${nuevoSaldoDestino},
                                "CodigoCuenta": ${codigoCuentaDestino}
                            }`)
                                .execute('sp_CuentaxCliente')
                        }).then(result => {
                            // actualizar cuentas en pagina usuario
                            sql.connect(config).then(pool => {
                                return result = pool.request()
                                    .input('Accion', 'S')
                                    .input('JSON', `{"CodigoCliente": ${codigoClienteOrigen}}`)
                                    .execute('sp_CuentaxCliente')
                            }).then(result => {
                                var dataCuentas = result.recordset[0]

                                if (dataCuentas[Object.keys(dataCuentas)[0]] !== '') {
                                    // obtener datos JSON
                                    var cuentasJSON = []

                                    for (let key in dataCuentas) {
                                        cuentasJSON = dataCuentas[key]
                                    }

                                    var objDatos = JSON.parse(cuentasJSON)
                                    cuentasCliente = objDatos.Lista_CuentaxCliente
                                }

                                // redirigir a la pagina de usuario
                                resultadoTransaccion = '¡Transferencia completada con éxito!'
                                sesionActiva = true
                                return res.redirect('/user')
                            }).catch(err => {
                                console.log(err)
                            })
                        }).catch(err => {
                            console.log(err)
                        });
                    }).catch(err => {
                        console.log(err)
                    });
                }).catch(err => {
                    console.log(err)
                });
            }
        }).catch(err => {
            console.log(err)
        })
    }).catch(err => {
        console.log(err)
    })
})


/* ------------------------------
------ actualizar usuario -------
------------------------------ */


app.post('/actualizar-usuario', function (req, res) {
    // obtener datos del formulario
    var PrimerNombre = req.body.PrimerNombre,
        SegundoNombre = req.body.SegundoNombre,
        PrimerApellido = req.body.PrimerApellido,
        SegundoApellido = req.body.SegundoApellido,
        Telefono = req.body.Telefono,
        Direccion = req.body.Direccion,
        CorreoElectronico = req.body.CorreoElectronico
        Contrasena = req.body.Contrasena,

        IDCliente = datosCliente.CodigoCliente,
        Identificacion = datosCliente.Identificacion,
        TipoIdentificacion = datosCliente.TipoIdentificacion,
        FechaNacimiento = datosCliente.FechaNacimiento,
        nuevoHash = bcrypt.hashSync(Contrasena, 9)

    sql.connect(config).then(pool => {
        return result = pool.request()
            .query(`select CodigoCliente from Cliente where CorreoElectronico = '${CorreoElectronico}'`)
    }).then(result => {
        var continuar = false

        if (result.recordsets[0].length > 0) {
            if (result.recordset[0].CodigoCliente == datosCliente.CodigoCliente) {
                continuar = true
            } else {
                sesionActiva = true
                resultadoTransaccion = '¡Ya existe una cuenta con ese correo, por favor use otro!'
                return res.redirect('/user')
            }
        } else {
            continuar = true
        }

        if (continuar === true) {
            // conexion al servidor para actualizar usuario
            sql.connect(config).then(pool => {
                // ejecutar stored procedure
                return result = pool.request()
                    .input('Accion', 'U')
                    .input('JSON', `{
                "CodigoCliente": "${IDCliente}",
                "Identificacion": "${Identificacion}",
                "TipoIdentificacion": "${TipoIdentificacion}",
                "PrimerNombre": "${PrimerNombre}",
                "SegundoNombre": "${SegundoNombre}",
                "PrimerApellido": "${PrimerApellido}",
                "SegundoApellido": "${SegundoApellido}",
                "FechaNacimiento": "${FechaNacimiento}",
                "Telefono": "${Telefono}",
                "Direccion": "${Direccion}",
                "CorreoElectronico": "${CorreoElectronico}",
                "Contrasena": "${nuevoHash}"
            }`)
                    .execute('sp_Cliente')
            }).then(result => {
                sql.connect(config).then(pool => {
                    // obtener datos actualizados para mostrar al usuario
                    return result = pool.request()
                        .input('Accion', 'S')
                        .input('JSON', `{"CorreoElectronico": "${CorreoElectronico}"}`)
                        .execute('sp_Cliente')
                }).then(result => {
                    var dataUsuario = result.recordset[0]

                    // obtener datos JSON
                    var datosJSON = []

                    for (let key in dataUsuario) {
                        datosJSON = dataUsuario[key]
                    }

                    var objDatos = JSON.parse(datosJSON)
                    datosCliente = objDatos.Lista_Cliente[0]

                    // refrescar pagina de usuario
                    resultadoTransaccion = '¡Datos actualizados con éxito!'
                    sesionActiva = true
                    return res.redirect('/user')
                }).catch(err => {
                    console.log(err)
                })
            }).catch(err => {
                console.log(err)
            })
        }
    }).catch(err => {
        console.log(err)
    })
})


// error 404 - pagina no encontrada
app.use((req, res, next) => {
    res.status(404).render('404')
})

// verificar puerto a la escucha
app.listen(port, () => {
    console.log('Escuchando en puerto', port)
})
