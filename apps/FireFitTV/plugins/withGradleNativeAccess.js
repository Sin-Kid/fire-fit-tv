// Newer JDKs (24+, e.g. the one bundled with recent Android Studio) print
// "WARNING: A restricted method in java.lang.System has been called" when native
// libraries load, and the Android CMake step treats that output as a failure.
// Allowing native access for the Gradle JVM removes the warning.
const { withGradleProperties } = require('expo/config-plugins');

const FLAG = '--enable-native-access=ALL-UNNAMED';

module.exports = function withGradleNativeAccess(config) {
  return withGradleProperties(config, (cfg) => {
    const props = cfg.modResults;
    const item = props.find((p) => p.type === 'property' && p.key === 'org.gradle.jvmargs');
    if (item) {
      if (!item.value.includes(FLAG)) item.value = `${item.value} ${FLAG}`;
    } else {
      props.push({ type: 'property', key: 'org.gradle.jvmargs', value: `-Xmx2048m -XX:MaxMetaspaceSize=512m ${FLAG}` });
    }
    return cfg;
  });
};
