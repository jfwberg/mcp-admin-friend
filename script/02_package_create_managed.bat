REM *****************************
REM        PACKAGE CREATION   
REM *****************************

REM Package Create Config
SET devHub=devHubAlias
SET packageName=MCP Admin Friend
SET packageDescription=MCP Admin Friend is an example Salesforce administrator Lightning Web Component that demonstrates authenticated Lightning Out 2.0 components communicating with an MCP client through an MCP App Bridge.
SET packageType=Managed
SET packagePath=force-app
SET definitionFile=config/project-scratch-def.json

REM Package Config
SET packageId=0HoP3000000020DKAQ
SET packageVersionId=04tP3000002D4HZIA0

REM Create package
sf package create --name "%packageName%" --description "%packageDescription%" --package-type "%packageType%" --path "%packagePath%" --target-dev-hub %devHub%

REM Create package version
sf package version create --package "%packageName%"  --target-dev-hub "%devHub%" --code-coverage --installation-key-bypass --wait 30 --definition-file "%definitionFile%"

REM Optional lifecycle command reference - run separately when deliberately required:
REM sf package delete --package %packageId% --target-dev-hub %devHub% --no-prompt
REM sf package version delete --package %packageVersionId% --target-dev-hub %devHub% --no-prompt
REM sf package version promote --package %packageVersionId% --target-dev-hub %devHub% --no-prompt

REM /packaging/installPackage.apexp?p0=04tP3000002D4HZIA0
