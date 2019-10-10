#!/bin/bash

cd "$(dirname $0)";
echo Building from directory: $PWD

# Make sure we have the local version of tsc.
# i.e. don't rely on the user running this from
# npm, they have installed, and there is not a 
# different version of tsc installed on the build
# system.
declare TSC_PATH="../node_modules/.bin/tsc";

if [ ! -e "$TSC_PATH" ] ; then
	echo "Failed to find tsc.  Please run 'npm install'."	
	exit 1;
fi

echo Clearing Old Build Directory
declare TS_OUT="./.tsOut";
if [ -d "$TS_OUT" ] ; then
	echo "rm -rf \"$TS_OUT\"";
	if !  rm -rf "$TS_OUT"; then 
		echo "Failed to remove old output!  Aborting";
		exit 1;
	fi;
fi

echo "Performing Typescript Build with tsc $($TSC_PATH --version)"

# Don't use the globally installed typescript 
# compiler.  Make sure you use the one from this 
# folder.
echo "$TSC_PATH" -p ./ts/. 
if ! "$TSC_PATH" -p ./ts/. ; then
	echo "Build Failed!  Stopping!";
	exit 1;
fi

echo "Build Succeeded"

# Make sure we have out index.js file even thought building succeeded.
declare TEST_FILE="$TS_OUT/index.js";
if [ ! -f "$TEST_FILE" ] ; then
	echo "Failed to find '$TEST_FILE'.  Aborting Replace JS";
	exit 1;
fi

# Clear the old output index.js and lib folder
echo "Clearing the old built .js files."
if [ -f ../index.js -o -f ../index.d.ts ] ; then
	if ! rm ../index.js ../index.d.ts ; then
		echo "Failed to remove the old js output."
		exit 1;
	fi
fi
if [ -d ../lib ] ; then
	if ! rm -rf ../lib ; then
		echo "Failed to remove the old js output."
		exit 1;
	fi
fi

echo "Moving the typescript build output into the root folder";
echo mv -v $TS_OUT/* .. 
if ! mv -v $TS_OUT/* .. ; then
	echo "Move Failed";
	exit 1;
fi

echo "Copying pegjs parser into working folder.";
if ! cp -rv parser ../lib ; then
	echo "Copy parser failed!";
	exit 1;
fi

echo "Success.  Please run 'npm run test' to validate everything works!";

exit 0;

