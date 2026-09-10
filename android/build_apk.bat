@echo off
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"
set "ANDROID_HOME=C:\Users\Admin\AppData\Local\Android\Sdk"
echo Using JAVA_HOME: %JAVA_HOME%
call gradlew.bat assembleDebug
