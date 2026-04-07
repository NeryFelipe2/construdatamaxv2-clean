<?xml version="1.0" encoding="UTF-8"?>

<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:fo="http://www.w3.org/1999/XSL/Format" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:fn="http://www.w3.org/2005/02/xpath-functions" xmlns:xdt="http://www.w3.org/2005/02/xpath-datatypes">
  <xsl:output method ="html"/>

  <!-- ================ -->
  <!-- Global Variables -->
  <!-- ================ -->
  <xsl:variable name="ForResetSettings" select="//Flag[@Category='Usage']/text()='ResetSettings'" />

  <!-- ======= -->
  <!-- Methods -->
  <!-- ======= -->

  <!-- [Method]: to output general information -->
  <xsl:template name="ShowGeneralInformation">
    <h1>General Information</h1>
    <!-- Dispatch to T4# -->
    <xsl:apply-templates select="//Message[@Category='GeneralInfo']"/>
    <hr />
  </xsl:template>

  
  <!-- [Method]: to output errors -->
  <xsl:template name="ShowErrors">
    <xsl:if test="count(//Registry[@Category = 'Error'] | //File[@Category = 'Error']) > 0">
      <h1>Errors</h1>
      <!-- Dispatch to T2# -->
      <xsl:apply-templates select="//Registry[@Category = 'Error']" />
      <!-- Dispatch to T3# -->
      <xsl:apply-templates select="//File[@Category = 'Error']" />
      <hr />
    </xsl:if>
  </xsl:template>


  <!-- [Method]: to output details -->
  <xsl:template name="ShowDetails">
    <h1>Migration Details</h1>
    <!-- Dispatch to T5#, T2#, T3# -->
    <xsl:apply-templates select="
                         //Registry[@Category='ProfileMigrated'] | //Registry[@Category = 'Error'] | 
                         //File[@Category = 'DataMigrated'] | File[@Category = 'Error']"/>
    <hr />
  </xsl:template>


  <!-- ========= -->
  <!-- Templates -->
  <!-- ========= -->

  <!-- T1# - Overall -->
  <xsl:template match="/">
    <xsl:choose>
      <xsl:when test="$ForResetSettings">
        <xsl:call-template name="ShowGeneralInformation" />
        <xsl:call-template name="ShowErrors" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:call-template name="ShowErrors" />
        <xsl:call-template name="ShowGeneralInformation" />
        <xsl:call-template name="ShowDetails" />
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <!-- T2# - Output Registry Errors -->
  <xsl:template match="//Registry[@Category = 'Error']">
    <p>
      <xsl:if test="not($ForResetSettings)">
        <xsl:value-of select="parent::*/@Name" />
        <xsl:text>: </xsl:text>
      </xsl:if>
      <xsl:copy-of select="* | text()" />
    </p>
  </xsl:template>

  <!-- T3# - Output File Errors -->
  <xsl:template match="//File[@Category = 'Error']">
    <p>
      <xsl:if test="not($ForResetSettings)">
        <xsl:value-of select="parent::*/@Name" />
        <xsl:text>: </xsl:text>
      </xsl:if>
      <xsl:copy-of select="* | text()" />
    </p>
  </xsl:template>

  <!-- T4# - Process Message node -->
  <xsl:template match="Message">
    <p>
      <xsl:text> </xsl:text>
      <xsl:copy-of select="* | text()" />
    </p>
  </xsl:template>

  <!-- T5# - Process Message node -->
  <xsl:template match="//Registry[@Category = 'ProfileMigrated'] | //File[@Category = 'DataMigrated']">
    <p>
      <b>
        <xsl:text> </xsl:text>
        <xsl:copy-of select="* | text()" />
      </b>
    </p>
  </xsl:template>

  <xsl:template match="text()">

  </xsl:template>


  <!-- The following templates are used to output details and currently
       are disabled.
  -->

  <xsl:template match="Section[@Name != 'Profile']">
    <!--<xsl:if test="child::*">-->
    <p>
      <b>
        <xsl:value-of select="@Name" />
      </b>
      <xsl:text>: </xsl:text>
    </p>
    <xsl:apply-templates/>
    <hr />
    <!--</xsl:if>-->
  </xsl:template>

  <xsl:template match="Section[@Name = 'Profile']">
    <xsl:if test="child::*">
      <p>
        <b>General</b>
        <xsl:text>: </xsl:text>
      </p>
      <xsl:apply-templates/>
    </xsl:if>
  </xsl:template>

  <xsl:template match="Registry | File">
    <p>
      <xsl:text> </xsl:text>
      <xsl:copy-of select="* | text()" />
    </p>
  </xsl:template>

  <xsl:template match="//Message[@Category = 'DetailInfo']">
    <p>
      <xsl:text> </xsl:text>
      <xsl:copy-of select="* | text()" />
    </p>
  </xsl:template>

  <xsl:template match="//Message[@Category = 'SummaryInfo']">
    <p>
      <xsl:text> </xsl:text>
      <xsl:copy-of select="* | text()" />
    </p>
  </xsl:template>

</xsl:stylesheet>
