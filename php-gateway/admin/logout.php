<?php
require_once __DIR__ . '/../config.php';
start_session_once();
$_SESSION = [];
session_destroy();
header('Location: login.php');
exit;
